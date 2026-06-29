package transcoder

import "testing"

func TestDecodeProbeOutput(t *testing.T) {
	const fixture = `{
		"format": {"duration": "596.3"},
		"streams": [
			{"codec_type": "audio", "width": 0, "height": 0},
			{"codec_type": "video", "width": 3840, "height": 2160}
		]
	}`

	info, err := decodeProbeOutput([]byte(fixture))
	if err != nil {
		t.Fatalf("decodeProbeOutput failed: %v", err)
	}

	if info.DurationSeconds != 596 {
		t.Fatalf("DurationSeconds = %d, want 596", info.DurationSeconds)
	}
	if info.Width != 3840 {
		t.Fatalf("Width = %d, want 3840", info.Width)
	}
	if info.Height != 2160 {
		t.Fatalf("Height = %d, want 2160", info.Height)
	}
}

func TestDecodeProbeOutputMissingDurationStillReturnsDimensions(t *testing.T) {
	const fixture = `{
		"format": {},
		"streams": [
			{"codec_type": "video", "width": 3840, "height": 2160}
		]
	}`

	info, err := decodeProbeOutput([]byte(fixture))
	if err != nil {
		t.Fatalf("decodeProbeOutput failed: %v", err)
	}

	if info.DurationSeconds != 0 {
		t.Fatalf("DurationSeconds = %d, want 0", info.DurationSeconds)
	}
	if info.Width != 3840 || info.Height != 2160 {
		t.Fatalf("size = %dx%d, want 3840x2160", info.Width, info.Height)
	}
}

func TestDecodeProbeOutputMissingVideoStream(t *testing.T) {
	const fixture = `{
		"format": {"duration": "596.3"},
		"streams": [
			{"codec_type": "audio", "width": 0, "height": 0}
		]
	}`

	if _, err := decodeProbeOutput([]byte(fixture)); err == nil {
		t.Fatal("expected error, got nil")
	}
}
