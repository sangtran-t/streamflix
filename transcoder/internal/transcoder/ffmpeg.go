// Package transcoder wraps ffmpeg and ffprobe to produce an HLS package from a
// raw source file. Implements B1 (per-job timeout + process-group kill) and
// B2 (poster-frame extraction).
package transcoder

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

// Rendition describes a single HLS quality level in the ABR ladder.
type Rendition struct {
	Name    string // subdirectory label, e.g. "360p"
	Height  int    // output height (width auto-scaled, even-rounded via scale=-2:H)
	Bitrate string // video target bitrate, e.g. "800k"
	MaxRate string // VBV ceiling, e.g. "856k"
	BufSize string // VBV decoder buffer, e.g. "1200k"
	ABR     string // audio bitrate, e.g. "96k"
}

// DefaultLadder is the production HLS ladder (ADR-0003).
// veryfast preset keeps local transcode times short (B1).
var DefaultLadder = []Rendition{
	{Name: "360p", Height: 360, Bitrate: "800k", MaxRate: "856k", BufSize: "1200k", ABR: "96k"},
	{Name: "480p", Height: 480, Bitrate: "1400k", MaxRate: "1498k", BufSize: "2100k", ABR: "128k"},
	{Name: "720p", Height: 720, Bitrate: "2800k", MaxRate: "2996k", BufSize: "4200k", ABR: "128k"},
	{Name: "1080p", Height: 1080, Bitrate: "5000k", MaxRate: "5350k", BufSize: "7500k", ABR: "192k"},
}

// HLSResult holds the local paths produced by Transcode.
type HLSResult struct {
	// MasterPath is the absolute path to the master playlist file.
	MasterPath string
	// Renditions lists the sub-directory names produced, e.g. ["360p","480p","720p","1080p"].
	Renditions []string
}

// Transcode runs a single ffmpeg invocation that encodes all renditions from
// the input file and writes an HLS package to outDir:
//
//	outDir/
//	  master.m3u8
//	  360p/index.m3u8   360p/seg_000.ts …
//	  480p/index.m3u8   …
//	  720p/index.m3u8   …
//	  1080p/index.m3u8  …
//
// The context must carry a deadline. If it expires, the ffmpeg process group
// is killed with SIGKILL (B1 — no orphaned transcodes).
func Transcode(ctx context.Context, inputPath, outDir string) (*HLSResult, error) {
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return nil, fmt.Errorf("transcode: mkdir %s: %w", outDir, err)
	}
	// Pre-create named sub-directories (required for ffmpeg %v substitution).
	for _, r := range DefaultLadder {
		if err := os.MkdirAll(filepath.Join(outDir, r.Name), 0o755); err != nil {
			return nil, fmt.Errorf("transcode: mkdir rendition %s: %w", r.Name, err)
		}
	}

	args := buildHLSArgs(inputPath, outDir, DefaultLadder)
	cmd := exec.CommandContext(ctx, "ffmpeg", args...) //nolint:gosec
	// Setpgid places ffmpeg in its own process group so SIGKILL on -Pid
	// reaches all child processes (B1).
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		if cmd.Process != nil {
			_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		}
		if ctx.Err() != nil {
			return nil, fmt.Errorf("transcode: timed out: %w", ctx.Err())
		}
		return nil, fmt.Errorf("transcode: ffmpeg non-zero exit: %w", err)
	}

	renditionNames := make([]string, len(DefaultLadder))
	for i, r := range DefaultLadder {
		renditionNames[i] = r.Name
	}
	return &HLSResult{
		MasterPath: filepath.Join(outDir, "master.m3u8"),
		Renditions: renditionNames,
	}, nil
}

// buildHLSArgs constructs the single-pass multi-rendition ffmpeg command line.
//
// Key design choices (ADR-0003):
//   - scale=-2:H: auto-calculates width to maintain aspect ratio; -2 ensures
//     the result is even (required by H.264/libx264).
//   - 4-second segments: balance startup latency vs segment request overhead.
//   - keyint_min=48 at 24 fps → 2 s GOP, aligned across renditions for clean
//     ABR switches at every segment boundary.
//   - independent_segments: every segment starts with a keyframe; ABR client
//     can start mid-stream without artefacts.
//   - var_stream_map with name: label → %v expands to the rendition name,
//     producing named sub-directories (e.g. "360p/", "720p/").
func buildHLSArgs(inputPath, outDir string, ladder []Rendition) []string {
	args := []string{
		"-y",
		"-i", inputPath,
		"-hide_banner",
		"-loglevel", "warning",
	}

	// One video + one audio map per rendition.
	for range ladder {
		args = append(args, "-map", "0:v:0", "-map", "0:a:0")
	}

	// Per-rendition encoding parameters.
	for i, r := range ladder {
		vi := fmt.Sprintf(":v:%d", i) // stream specifier suffix, e.g. ":v:0"
		ai := fmt.Sprintf(":a:%d", i)
		args = append(args,
			// scale=-2:H → width auto-calculated, even-rounded, aspect preserved.
			"-vf"+vi, fmt.Sprintf("scale=-2:%d", r.Height),
			"-c"+vi, "libx264",
			"-preset"+vi, "veryfast",
			"-b"+vi, r.Bitrate,
			"-maxrate"+vi, r.MaxRate,
			"-bufsize"+vi, r.BufSize,
			// 48-frame GOP at 24 fps = 2 s, keyframe-aligned across renditions.
			"-g"+vi, "48",
			"-keyint_min"+vi, "48",
			"-sc_threshold"+vi, "0", // uniform spacing, no scene-cut keyframes
			"-c"+ai, "aac",
			"-b"+ai, r.ABR,
			"-ac", "2",
		)
	}

	// var_stream_map: "v:0,a:0,name:360p v:1,a:1,name:480p …"
	varStreamMap := ""
	for i, r := range ladder {
		if i > 0 {
			varStreamMap += " "
		}
		varStreamMap += fmt.Sprintf("v:%d,a:%d,name:%s", i, i, r.Name)
	}

	// Segment and playlist path patterns.
	// %v is replaced by the name: label from var_stream_map (e.g. "360p").
	segPattern := filepath.Join(outDir, "%v", "seg_%03d.ts")
	playlistPattern := filepath.Join(outDir, "%v", "index.m3u8")

	args = append(args,
		"-f", "hls",
		"-hls_time", "4",
		"-hls_playlist_type", "vod",
		"-hls_flags", "independent_segments",
		"-hls_segment_type", "mpegts",
		"-hls_segment_filename", segPattern,
		// -master_pl_name takes just the filename; ffmpeg writes it to the
		// parent of the first variant playlist (i.e. outDir/).
		"-master_pl_name", "master.m3u8",
		"-var_stream_map", varStreamMap,
		"-hls_list_size", "0",
		playlistPattern,
	)

	return args
}
