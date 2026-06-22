package transcoder

import (
	"context"
	"fmt"
	"os/exec"
	"path/filepath"
	"syscall"
)

// ExtractPoster extracts a single frame at offsetSeconds from inputPath and saves it as outDir/poster.jpg.
func ExtractPoster(ctx context.Context, inputPath, outDir string, offsetSeconds int) (string, error) {
	outPath := filepath.Join(outDir, "poster.jpg")
	cmd := exec.CommandContext(ctx, "ffmpeg", //nolint:gosec
		"-y",
		"-ss", fmt.Sprintf("%d", offsetSeconds),
		"-i", inputPath,
		"-vframes", "1",
		"-q:v", "2", // JPEG quality (2 = near-lossless, range 2–31)
		"-hide_banner",
		"-loglevel", "warning",
		outPath,
	)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	if err := cmd.Run(); err != nil {
		if cmd.Process != nil {
			_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		}
		return "", fmt.Errorf("poster: ffmpeg exited non-zero: %w", err)
	}
	return outPath, nil
}
