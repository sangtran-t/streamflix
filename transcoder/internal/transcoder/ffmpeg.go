// Package transcoder wraps ffmpeg and ffprobe to produce an HLS package from a raw source file.
package transcoder

import (
	"context"
	"fmt"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

// Rendition describes a single HLS quality level in the ABR ladder.
type Rendition struct {
	Name    string // subdirectory label, e.g. "360p"
	Width   int    // output width; 0 means auto-calculate from height
	Height  int    // output height (width auto-scaled, even-rounded via scale=-2:H)
	Bitrate string // video target bitrate, e.g. "800k"
	MaxRate string // VBV ceiling, e.g. "856k"
	BufSize string // VBV decoder buffer, e.g. "1200k"
	ABR     string // audio bitrate, e.g. "96k"
}

// DefaultLadder is the production HLS ladder.
var DefaultLadder = []Rendition{
	{Name: "360p", Height: 360, Bitrate: "800k", MaxRate: "856k", BufSize: "1200k", ABR: "96k"},
	{Name: "480p", Height: 480, Bitrate: "1400k", MaxRate: "1498k", BufSize: "2100k", ABR: "128k"},
	{Name: "720p", Height: 720, Bitrate: "2800k", MaxRate: "2996k", BufSize: "4200k", ABR: "128k"},
	{Name: "1080p", Height: 1080, Bitrate: "5000k", MaxRate: "5350k", BufSize: "7500k", ABR: "192k"},
}

// LadderForSourceDimensions extends the base ladder with a native top rung so
// 2K/4K sources keep their original resolution instead of being flattened to
// 1080p.
func LadderForSourceDimensions(sourceWidth, sourceHeight int) []Rendition {
	ladder := cloneLadder(DefaultLadder)
	if sourceWidth <= 0 || sourceHeight <= 0 {
		return ladder
	}

	if sourceWidth > 1920 || sourceHeight > 1080 {
		ladder = append(ladder, sourceTopRendition(sourceWidth, sourceHeight))
	}

	return ladder
}

func cloneLadder(src []Rendition) []Rendition {
	cloned := make([]Rendition, len(src))
	copy(cloned, src)
	return cloned
}

func sourceTopRendition(sourceWidth, sourceHeight int) Rendition {
	width := evenFloor(sourceWidth)
	height := evenFloor(sourceHeight)
	bitrateKbps := int(math.Round(float64(width*height) / (1920.0 * 1080.0) * 5000.0))
	if bitrateKbps < 5000 {
		bitrateKbps = 5000
	}
	maxRateKbps := int(math.Round(float64(bitrateKbps) * 1.07))
	bufSizeKbps := int(math.Round(float64(bitrateKbps) * 1.5))
	abr := "192k"
	if height >= 2160 {
		abr = "256k"
	}

	return Rendition{
		Name:    fmt.Sprintf("%dx%d", width, height),
		Width:   width,
		Height:  height,
		Bitrate: fmt.Sprintf("%dk", bitrateKbps),
		MaxRate: fmt.Sprintf("%dk", maxRateKbps),
		BufSize: fmt.Sprintf("%dk", bufSizeKbps),
		ABR:     abr,
	}
}

func evenFloor(value int) int {
	if value%2 == 0 {
		return value
	}
	return value - 1
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
// The context must carry a deadline; if it expires the ffmpeg process group
// is killed with SIGKILL so no orphaned transcodes are left behind.
func Transcode(ctx context.Context, inputPath, outDir string, ladder []Rendition) (*HLSResult, error) {
	if len(ladder) == 0 {
		ladder = DefaultLadder
	}
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return nil, fmt.Errorf("transcode: mkdir %s: %w", outDir, err)
	}
	// Pre-create named sub-directories (required for ffmpeg %v substitution).
	for _, r := range ladder {
		if err := os.MkdirAll(filepath.Join(outDir, r.Name), 0o755); err != nil {
			return nil, fmt.Errorf("transcode: mkdir rendition %s: %w", r.Name, err)
		}
	}

	args := buildHLSArgs(inputPath, outDir, ladder)
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

	renditionNames := make([]string, len(ladder))
	for i, r := range ladder {
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
		"-fflags", "+igndts", // tolerate minor timestamp gaps in source files
		"-i", inputPath,
		"-hide_banner",
		"-loglevel", "warning",
	}

	// One video + one audio map per rendition.
	for range ladder {
		args = append(args, "-map", "0:v:0", "-map", "0:a:0")
	}

	// Per-rendition encoding parameters.
	//
	// IMPORTANT: use -filter:v:N (not -vf:v:N) for per-stream scale filters.
	// -vf is an alias for -filter:v (already implies :v), so adding :v:N after
	// it is not parsed as a stream specifier — ffmpeg silently assigns every
	// -vf option to stream 0, meaning all renditions end up with the last
	// scale value (1080p). -filter:v:N is the correct explicit form.
	for i, r := range ladder {
		vi := fmt.Sprintf(":v:%d", i) // e.g. ":v:0"
		ai := fmt.Sprintf(":a:%d", i) // e.g. ":a:0"
		scale := fmt.Sprintf("scale=-2:%d", r.Height)
		if r.Width > 0 && r.Height > 0 {
			scale = fmt.Sprintf("scale=%d:%d", r.Width, r.Height)
		}
		args = append(args,
			// scale=-2:H → width auto-calculated, even-rounded, aspect preserved.
			fmt.Sprintf("-filter:v:%d", i), scale,
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
			// Use per-stream specifier to avoid "multiple -ac" warnings.
			fmt.Sprintf("-ac:a:%d", i), "2",
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
