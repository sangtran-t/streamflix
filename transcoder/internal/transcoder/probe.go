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
}

// ProbeSeconds returns the duration of the media file at path in whole seconds
// using ffprobe. Returns an error if ffprobe is unavailable or the file cannot
// be probed.
func ProbeSeconds(ctx context.Context, path string) (int, error) {
	cmd := exec.CommandContext(ctx, "ffprobe", //nolint:gosec
		"-v", "quiet",
		"-print_format", "json",
		"-show_format",
		path,
	)
	out, err := cmd.Output()
	if err != nil {
		return 0, fmt.Errorf("ffprobe: %w", err)
	}

	var result ffprobeOutput
	if err := json.Unmarshal(out, &result); err != nil {
		return 0, fmt.Errorf("ffprobe: unmarshal: %w", err)
	}

	durStr := strings.TrimSpace(result.Format.Duration)
	if durStr == "" || durStr == "N/A" {
		return 0, fmt.Errorf("ffprobe: duration not available")
	}

	dur, err := strconv.ParseFloat(durStr, 64)
	if err != nil {
		return 0, fmt.Errorf("ffprobe: parse duration %q: %w", durStr, err)
	}

	return int(math.Round(dur)), nil
}
