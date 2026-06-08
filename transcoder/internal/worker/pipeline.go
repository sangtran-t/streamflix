package worker

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"go.uber.org/zap"

	"streamflix/transcoder/internal/publisher"
	"streamflix/transcoder/internal/storage"
	"streamflix/transcoder/internal/transcoder"
)

const schemaVersion = "1.1"

// Pipeline runs the full transcode workflow for a single job:
//
//	download source → transcode (ffmpeg) → ffprobe → poster → upload → publish ready
//
// It publishes status updates throughout. On error it publishes "failed" and
// returns the error so the consumer can decide whether to retry.
type Pipeline struct {
	storage   *storage.Client
	publisher *publisher.Publisher
	logger    *zap.Logger
	tmpBase   string // base directory for temporary working files
}

// NewPipeline creates a Pipeline. tmpBase is the directory under which
// per-job temp folders are created (defaults to os.TempDir()).
func NewPipeline(st *storage.Client, pub *publisher.Publisher, logger *zap.Logger, tmpBase string) *Pipeline {
	if tmpBase == "" {
		tmpBase = os.TempDir()
	}
	return &Pipeline{storage: st, publisher: pub, logger: logger, tmpBase: tmpBase}
}

// Run executes the full pipeline for job within the given context (which
// carries the per-job deadline set by the consumer).
func (p *Pipeline) Run(ctx context.Context, job TranscodeJob) error {
	log := p.logger.With(
		zap.String("assetId", job.AssetID),
		zap.String("correlationId", job.CorrelationID),
		zap.String("jobId", job.JobID),
	)

	p.publishStatus(ctx, job, "processing", nil, log)

	// 1. Create a per-job temp directory (cleaned up on exit).
	workDir := filepath.Join(p.tmpBase, "sf-transcode-"+job.AssetID)
	if err := os.MkdirAll(workDir, 0o755); err != nil {
		return p.fail(ctx, job, "MKDIR_FAILED", err, log)
	}
	defer func() {
		if err := os.RemoveAll(workDir); err != nil {
			log.Warn("failed to clean up work dir", zap.String("dir", workDir), zap.Error(err))
		}
	}()

	// 2. Download the source file from MinIO.
	log.Info("downloading source", zap.String("inputKey", job.InputKey))
	ext := extensionFromKey(job.InputKey)
	localSrc := filepath.Join(workDir, "source."+ext)
	if err := p.download(ctx, job.InputKey, localSrc); err != nil {
		return p.fail(ctx, job, "DOWNLOAD_FAILED", err, log)
	}

	// 3. Run ffmpeg HLS transcode.
	hlsDir := filepath.Join(workDir, "hls")
	log.Info("transcoding", zap.String("outDir", hlsDir))
	result, err := transcoder.Transcode(ctx, localSrc, hlsDir)
	if err != nil {
		return p.fail(ctx, job, "FFMPEG_NONZERO", err, log)
	}

	// 4. Probe duration with ffprobe.
	durationSec, err := transcoder.ProbeSeconds(ctx, localSrc)
	if err != nil {
		log.Warn("ffprobe failed — duration will be null", zap.Error(err))
		durationSec = 0
	}

	// 5. Extract poster frame (B2) — best-effort, does not fail the job.
	posterKey := p.extractAndUploadPoster(ctx, job, localSrc, workDir, log)

	// 6. Upload all HLS files to MinIO.
	log.Info("uploading HLS package", zap.String("hlsDir", hlsDir))
	if err := p.uploadHLS(ctx, job.AssetID, hlsDir, result); err != nil {
		return p.fail(ctx, job, "UPLOAD_FAILED", err, log)
	}

	// 7. Publish "ready" status.
	masterKey := fmt.Sprintf("hls/%s/master.m3u8", job.AssetID)
	dur := durationSec
	msg := StatusMessage{
		SchemaVersion:   schemaVersion,
		AssetID:         job.AssetID,
		CorrelationID:   job.CorrelationID,
		Status:          "ready",
		DurationSeconds: intPtr(dur),
		Renditions:      result.Renditions,
		HLSMasterKey:    strPtr(masterKey),
		At:              time.Now().UTC(),
	}
	if posterKey != "" {
		msg.PosterKey = strPtr(posterKey)
	}
	p.publisher.Publish(ctx, msg)

	log.Info("job complete",
		zap.String("masterKey", masterKey),
		zap.Int("durationSeconds", dur),
		zap.Strings("renditions", result.Renditions),
	)
	return nil
}

// ── Private helpers ──────────────────────────────────────────────────────────

func (p *Pipeline) download(ctx context.Context, key, dest string) error {
	rc, _, err := p.storage.GetObject(ctx, key)
	if err != nil {
		return err
	}
	defer rc.Close()

	f, err := os.Create(dest)
	if err != nil {
		return fmt.Errorf("pipeline: create %s: %w", dest, err)
	}
	defer f.Close()

	if _, err := io.Copy(f, rc); err != nil {
		return fmt.Errorf("pipeline: write %s: %w", dest, err)
	}
	return nil
}

func (p *Pipeline) uploadHLS(ctx context.Context, assetID, hlsDir string, result *transcoder.HLSResult) error {
	// Upload master playlist.
	masterKey := fmt.Sprintf("hls/%s/master.m3u8", assetID)
	if err := p.uploadFile(ctx, masterKey, result.MasterPath, "application/vnd.apple.mpegurl"); err != nil {
		return err
	}

	// Upload per-rendition playlists and segments.
	for _, rend := range result.Renditions {
		rendDir := filepath.Join(hlsDir, rend)
		entries, err := os.ReadDir(rendDir)
		if err != nil {
			return fmt.Errorf("pipeline: readdir %s: %w", rendDir, err)
		}
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			localPath := filepath.Join(rendDir, e.Name())
			remoteKey := fmt.Sprintf("hls/%s/%s/%s", assetID, rend, e.Name())
			ct := contentTypeFor(e.Name())
			if err := p.uploadFile(ctx, remoteKey, localPath, ct); err != nil {
				return err
			}
		}
	}
	return nil
}

func (p *Pipeline) uploadFile(ctx context.Context, key, localPath, contentType string) error {
	f, err := os.Open(localPath)
	if err != nil {
		return fmt.Errorf("pipeline: open %s: %w", localPath, err)
	}
	defer f.Close()

	fi, err := f.Stat()
	if err != nil {
		return fmt.Errorf("pipeline: stat %s: %w", localPath, err)
	}

	return p.storage.PutObject(ctx, key, f, fi.Size(), contentType)
}

func (p *Pipeline) extractAndUploadPoster(
	ctx context.Context,
	job TranscodeJob,
	localSrc, workDir string,
	log *zap.Logger,
) string {
	posterPath, err := transcoder.ExtractPoster(ctx, localSrc, workDir, 5)
	if err != nil {
		log.Warn("poster extraction failed (non-fatal)", zap.Error(err))
		return ""
	}
	posterKey := fmt.Sprintf("hls/%s/poster.jpg", job.AssetID)
	if err := p.uploadFile(ctx, posterKey, posterPath, "image/jpeg"); err != nil {
		log.Warn("poster upload failed (non-fatal)", zap.String("key", posterKey), zap.Error(err))
		return ""
	}
	log.Info("poster uploaded", zap.String("key", posterKey))
	return posterKey
}

func (p *Pipeline) fail(
	ctx context.Context,
	job TranscodeJob,
	code string,
	err error,
	log *zap.Logger,
) error {
	log.Error("job failed", zap.String("errorCode", code), zap.Error(err))
	errMsg := err.Error()
	msg := StatusMessage{
		SchemaVersion: schemaVersion,
		AssetID:       job.AssetID,
		CorrelationID: job.CorrelationID,
		Status:        "failed",
		ErrorCode:     strPtr(code),
		Message:       strPtr(errMsg),
		At:            time.Now().UTC(),
	}
	p.publisher.Publish(ctx, msg)
	return fmt.Errorf("%s: %w", code, err)
}

func (p *Pipeline) publishStatus(
	ctx context.Context,
	job TranscodeJob,
	status string,
	progress *float64,
	log *zap.Logger,
) {
	msg := StatusMessage{
		SchemaVersion: schemaVersion,
		AssetID:       job.AssetID,
		CorrelationID: job.CorrelationID,
		Status:        status,
		Progress:      progress,
		At:            time.Now().UTC(),
	}
	p.publisher.Publish(ctx, msg)
	log.Info("status published", zap.String("status", status))
}

func extensionFromKey(key string) string {
	parts := strings.Split(key, ".")
	if len(parts) < 2 {
		return "mp4"
	}
	return parts[len(parts)-1]
}

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
