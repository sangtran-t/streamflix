package transcoder

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os/exec"
	"strconv"
	"strings"
)

// ffprobeOutput is a partial unmarshalling of ffprobe JSON output.
type ffprobeOutput struct {
	Format struct {
		Duration string `json:"duration"`
	} `json:"format"`
	Streams []struct {
		CodecType string `json:"codec_type"`
		Width     int    `json:"width"`
		Height    int    `json:"height"`
	} `json:"streams"`
}

// MediaInfo is the subset of ffprobe metadata the transcode worker needs.
type MediaInfo struct {
	DurationSeconds int
	Width           int
	Height          int
}

// ProbeMediaInfo returns the duration and first video-stream dimensions for the
// media file at path.
func ProbeMediaInfo(ctx context.Context, path string) (MediaInfo, error) {
	cmd := exec.CommandContext(ctx, "ffprobe", //nolint:gosec
		"-v", "quiet",
		"-print_format", "json",
		"-show_format",
		"-show_streams",
		"-select_streams", "v:0",
		path,
	)
	out, err := cmd.Output()
	if err != nil {
		return MediaInfo{}, fmt.Errorf("ffprobe: %w", err)
	}

	return decodeProbeOutput(out)
}

// ProbeSeconds returns the duration of the media file at path in whole seconds
// using ffprobe. Returns an error if ffprobe is unavailable or the file cannot
// be probed.
func ProbeSeconds(ctx context.Context, path string) (int, error) {
	info, err := ProbeMediaInfo(ctx, path)
	if err != nil {
		return 0, err
	}
	return info.DurationSeconds, nil
}

func decodeProbeOutput(out []byte) (MediaInfo, error) {
	var result ffprobeOutput
	if err := json.Unmarshal(out, &result); err != nil {
		return MediaInfo{}, fmt.Errorf("ffprobe: unmarshal: %w", err)
	}

	durStr := strings.TrimSpace(result.Format.Duration)
	mediaInfo := MediaInfo{}
	if durStr != "" && durStr != "N/A" {
		dur, err := strconv.ParseFloat(durStr, 64)
		if err != nil {
			return MediaInfo{}, fmt.Errorf("ffprobe: parse duration %q: %w", durStr, err)
		}
		mediaInfo.DurationSeconds = int(math.Round(dur))
	}
	for _, stream := range result.Streams {
		if stream.CodecType != "video" {
			continue
		}
		mediaInfo.Width = stream.Width
		mediaInfo.Height = stream.Height
		break
	}
	if mediaInfo.Height <= 0 {
		return MediaInfo{}, fmt.Errorf("ffprobe: video stream height not available")
	}

	return mediaInfo, nil
}
