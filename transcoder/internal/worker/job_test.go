package worker

import (
	"encoding/json"
	"testing"
	"time"
)

// TestJobDeserialization is a contract test that verifies the Go worker can
// correctly deserialise the canonical job message produced by NestJS.
// Canonical definition: docs/COMMUNICATION.md §2.
//
// If this test breaks after a change to the job schema, both sides of the
// Nest ↔ Go boundary must be updated together.
func TestJobDeserialization(t *testing.T) {
	// Canonical JSON fixture — must match what NestJS produces.
	const fixture = `{
		"schemaVersion": "1.0",
		"jobId":         "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
		"assetId":       "11111111-2222-3333-4444-555555555555",
		"correlationId": "cccccccc-cccc-cccc-cccc-cccccccccccc",
		"inputKey":      "raw/11111111-2222-3333-4444-555555555555/source.mp4",
		"title":         "Test Title",
		"requestedAt":   "2026-06-07T10:00:00Z"
	}`

	var job TranscodeJob
	if err := json.Unmarshal([]byte(fixture), &job); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	checks := []struct {
		name string
		got  string
		want string
	}{
		{"schemaVersion", job.SchemaVersion, "1.0"},
		{"jobId", job.JobID, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"},
		{"assetId", job.AssetID, "11111111-2222-3333-4444-555555555555"},
		{"correlationId", job.CorrelationID, "cccccccc-cccc-cccc-cccc-cccccccccccc"},
		{"inputKey", job.InputKey, "raw/11111111-2222-3333-4444-555555555555/source.mp4"},
		{"title", job.Title, "Test Title"},
	}
	for _, c := range checks {
		if c.got != c.want {
			t.Errorf("field %s: got %q, want %q", c.name, c.got, c.want)
		}
	}

	wantTime, _ := time.Parse(time.RFC3339, "2026-06-07T10:00:00Z")
	if !job.RequestedAt.Equal(wantTime) {
		t.Errorf("requestedAt: got %v, want %v", job.RequestedAt, wantTime)
	}
}

// TestStatusMessageSerialization verifies the "ready" status message includes
// all required fields and the posterKey extension (COMMUNICATION.md §3 v1.1).
func TestStatusMessageSerialization(t *testing.T) {
	dur := 120
	master := "hls/asset-1/master.m3u8"
	poster := "hls/asset-1/poster.jpg"

	msg := StatusMessage{
		SchemaVersion:   "1.1",
		AssetID:         "asset-1",
		CorrelationID:   "corr-1",
		Status:          "ready",
		DurationSeconds: intPtr(dur),
		Renditions:      []string{"360p", "480p", "720p", "1080p"},
		HLSMasterKey:    strPtr(master),
		PosterKey:       strPtr(poster),
		At:              time.Now(),
	}

	b, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	var out map[string]any
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatalf("re-unmarshal failed: %v", err)
	}

	for _, key := range []string{
		"schemaVersion", "assetId", "correlationId", "status",
		"durationSeconds", "renditions", "hlsMasterKey", "posterKey", "at",
	} {
		if _, ok := out[key]; !ok {
			t.Errorf("missing key %q in serialised status message", key)
		}
	}

	if out["posterKey"] != poster {
		t.Errorf("posterKey: got %v, want %q", out["posterKey"], poster)
	}
}
