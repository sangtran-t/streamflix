// Package activities contains Temporal activity implementations for the transcode worker.
package activities

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"go.temporal.io/sdk/activity"
	sdktemporal "go.temporal.io/sdk/temporal"
	"go.uber.org/zap"

	"streamflix/transcoder/internal/storage"
	"streamflix/transcoder/internal/transcoder"
	"streamflix/transcoder/internal/worker"
)

// TranscodeResult holds the output produced by RunTranscode.
// It is serialised as the activity result and passed to downstream activities.
type TranscodeResult struct {
	MasterKey       string   `json:"masterKey"`
	DurationSeconds int      `json:"durationSeconds"`
	Renditions      []string `json:"renditions"`
	PosterKey       string   `json:"posterKey"` // empty string if extraction failed
}

// TranscodeActivities groups the activities that perform the actual
// ffmpeg transcode and MinIO upload work.
type TranscodeActivities struct {
	store   *storage.Client
	logger  *zap.Logger
	tmpBase string
}

// NewTranscodeActivities creates a TranscodeActivities.
// tmpBase is the parent directory for per-job working directories;
// if empty, os.TempDir() is used.
func NewTranscodeActivities(store *storage.Client, logger *zap.Logger, tmpBase string) *TranscodeActivities {
	if tmpBase == "" {
		tmpBase = os.TempDir()
	}
	return &TranscodeActivities{store: store, logger: logger, tmpBase: tmpBase}
}

// RunTranscode downloads the source asset, runs ffmpeg, probes duration,
// extracts a poster frame, uploads the HLS package, and returns a
// TranscodeResult.
//
// If ffmpeg exits non-zero the activity returns a NonRetryableApplicationError
// with type "FFMPEG_NONZERO" — retrying a corrupt video is pointless, and the
// workflow will skip further retries and move straight to PublishFailed.
// All other failures return wrapped errors that Temporal will retry.
func (a *TranscodeActivities) RunTranscode(ctx context.Context, job worker.TranscodeJob) (TranscodeResult, error) {
	log := a.logger.With(
		zap.String("assetId", job.AssetID),
		zap.String("correlationId", job.CorrelationID),
		zap.String("jobId", job.JobID),
	)

	// 1. Per-job working directory — cleaned up on exit regardless of outcome.
	info := activity.GetInfo(ctx)
	workDir := filepath.Join(a.tmpBase, fmt.Sprintf("sf-transcode-%s-%d", job.AssetID, info.Attempt))
	if err := os.MkdirAll(workDir, 0o755); err != nil {
		return TranscodeResult{}, fmt.Errorf("mkdir workdir: %w", err)
	}
	defer func() {
		if err := os.RemoveAll(workDir); err != nil {
			log.Warn("failed to clean up work dir", zap.String("dir", workDir), zap.Error(err))
		}
	}()

	// 2. Download source from MinIO.
	log.Info("downloading source", zap.String("inputKey", job.InputKey))
	ext := extensionFromKey(job.InputKey)
	localSrc := filepath.Join(workDir, "source."+ext)
	if err := download(ctx, a.store, job.InputKey, localSrc); err != nil {
		return TranscodeResult{}, fmt.Errorf("download: %w", err)
	}

	// 3. Probe the source once up front so we can preserve 2K/4K inputs and
	// derive the duration without a second ffprobe pass.
	mediaInfo, err := transcoder.ProbeMediaInfo(ctx, localSrc)
	if err != nil {
		log.Warn("ffprobe failed — using default ladder and duration 0", zap.Error(err))
		mediaInfo = transcoder.MediaInfo{}
	}
	ladder := transcoder.LadderForSourceDimensions(mediaInfo.Width, mediaInfo.Height)
	durationSec := mediaInfo.DurationSeconds

	// 4. Heartbeat before starting ffmpeg.
	activity.RecordHeartbeat(ctx, "transcoding")

	// Start a background heartbeater. ffmpeg takes longer than the 30s HeartbeatTimeout,
	// and cmd.Run() blocks, meaning the Temporal SDK wouldn't heartbeat on its own.
	hbCtx, cancelHb := context.WithCancel(ctx)
	defer cancelHb()
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				activity.RecordHeartbeat(ctx, "transcoding")
			case <-hbCtx.Done():
				return
			}
		}
	}()

	// 5. Run ffmpeg HLS transcode.
	// Non-retryable: a corrupt/unsupported source will not improve on retry.
	hlsDir := filepath.Join(workDir, "hls")
	log.Info("transcoding", zap.String("outDir", hlsDir), zap.Int("sourceWidth", mediaInfo.Width), zap.Int("sourceHeight", mediaInfo.Height))
	result, err := transcoder.Transcode(ctx, localSrc, hlsDir, ladder)
	if err != nil {
		return TranscodeResult{}, sdktemporal.NewNonRetryableApplicationError(
			"ffmpeg failed", "FFMPEG_NONZERO", err,
		)
	}

	// 6. Heartbeat: upload phase.
	activity.RecordHeartbeat(ctx, "uploading")

	// 7. Extract and upload poster frame — best-effort; does not fail the job.
	posterKey := extractAndUploadPoster(ctx, a.store, job, localSrc, workDir, log)

	// 8. Upload HLS package to MinIO.
	log.Info("uploading HLS package", zap.String("hlsDir", hlsDir))
	if err := uploadHLS(ctx, a.store, job.AssetID, hlsDir, result); err != nil {
		return TranscodeResult{}, fmt.Errorf("upload HLS: %w", err)
	}

	masterKey := fmt.Sprintf("hls/%s/master.m3u8", job.AssetID)
	log.Info("transcode complete",
		zap.String("masterKey", masterKey),
		zap.Int("durationSeconds", durationSec),
		zap.Strings("renditions", result.Renditions),
	)

	return TranscodeResult{
		MasterKey:       masterKey,
		DurationSeconds: durationSec,
		Renditions:      result.Renditions,
		PosterKey:       posterKey,
	}, nil
}

// download fetches key from MinIO and writes it to the local path dest.
func download(ctx context.Context, store *storage.Client, key, dest string) error {
	rc, _, err := store.GetObject(ctx, key)
	if err != nil {
		return err
	}
	defer rc.Close()

	f, err := os.Create(dest)
	if err != nil {
		return fmt.Errorf("create %s: %w", dest, err)
	}
	defer f.Close()

	if _, err := io.Copy(f, rc); err != nil {
		return fmt.Errorf("write %s: %w", dest, err)
	}
	return nil
}

// uploadHLS uploads the master playlist and all per-rendition segments.
func uploadHLS(
	ctx context.Context,
	store *storage.Client,
	assetID, hlsDir string,
	result *transcoder.HLSResult,
) error {
	// Master playlist.
	masterKey := fmt.Sprintf("hls/%s/master.m3u8", assetID)
	if err := uploadFile(ctx, store, masterKey, result.MasterPath, "application/vnd.apple.mpegurl"); err != nil {
		return err
	}

	// Per-rendition playlists and segments.
	for _, rend := range result.Renditions {
		rendDir := filepath.Join(hlsDir, rend)
		entries, err := os.ReadDir(rendDir)
		if err != nil {
			return fmt.Errorf("readdir %s: %w", rendDir, err)
		}
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			localPath := filepath.Join(rendDir, e.Name())
			remoteKey := fmt.Sprintf("hls/%s/%s/%s", assetID, rend, e.Name())
			if err := uploadFile(ctx, store, remoteKey, localPath, contentTypeFor(e.Name())); err != nil {
				return err
			}
		}
	}
	return nil
}

// uploadFile opens a local file and PUTs it to the given MinIO key.
func uploadFile(ctx context.Context, store *storage.Client, key, localPath, contentType string) error {
	f, err := os.Open(localPath)
	if err != nil {
		return fmt.Errorf("open %s: %w", localPath, err)
	}
	defer f.Close()

	fi, err := f.Stat()
	if err != nil {
		return fmt.Errorf("stat %s: %w", localPath, err)
	}

	return store.PutObject(ctx, key, f, fi.Size(), contentType)
}

// extractAndUploadPoster extracts a poster frame and uploads it.
// All failures are logged as warnings; the empty string is returned on any error.
func extractAndUploadPoster(
	ctx context.Context,
	store *storage.Client,
	job worker.TranscodeJob,
	localSrc, workDir string,
	log *zap.Logger,
) string {
	posterPath, err := transcoder.ExtractPoster(ctx, localSrc, workDir, 5)
	if err != nil {
		log.Warn("poster extraction failed (non-fatal)", zap.Error(err))
		return ""
	}
	posterKey := fmt.Sprintf("hls/%s/poster.jpg", job.AssetID)
	if err := uploadFile(ctx, store, posterKey, posterPath, "image/jpeg"); err != nil {
		log.Warn("poster upload failed (non-fatal)", zap.String("key", posterKey), zap.Error(err))
		return ""
	}
	log.Info("poster uploaded", zap.String("key", posterKey))
	return posterKey
}

// extensionFromKey returns the file extension from a storage key, without the dot.
// Falls back to "mp4" when the key has no extension.
func extensionFromKey(key string) string {
	ext := filepath.Ext(key)
	if ext == "" {
		return "mp4"
	}
	return strings.TrimPrefix(ext, ".")
}

// contentTypeFor returns the MIME type for common HLS file extensions.
func contentTypeFor(name string) string {
	switch {
	case strings.HasSuffix(name, ".m3u8"):
		return "application/vnd.apple.mpegurl"
	case strings.HasSuffix(name, ".ts"):
		return "video/mp2t"
	default:
		return "application/octet-stream"
	}
}
