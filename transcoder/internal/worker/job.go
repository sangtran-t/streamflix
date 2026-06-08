// Package worker implements the Redis Streams consumer loop that picks up
// transcode jobs, runs ffmpeg, and reports status back via pub/sub.
package worker

import "time"

// TranscodeJob is the message schema published to the "transcode:jobs" stream
// by NestJS and consumed by this worker.
// Canonical definition: docs/COMMUNICATION.md §2.
type TranscodeJob struct {
	SchemaVersion string    `json:"schemaVersion"`
	JobID         string    `json:"jobId"`
	AssetID       string    `json:"assetId"`
	CorrelationID string    `json:"correlationId"`
	InputKey      string    `json:"inputKey"`
	Title         string    `json:"title"`
	RequestedAt   time.Time `json:"requestedAt"`
}

// StatusMessage is published to the "transcode:status" pub/sub channel.
// Canonical definition: docs/COMMUNICATION.md §3.
type StatusMessage struct {
	SchemaVersion   string    `json:"schemaVersion"`
	AssetID         string    `json:"assetId"`
	CorrelationID   string    `json:"correlationId"`
	Status          string    `json:"status"` // queued | processing | ready | failed
	Progress        *float64  `json:"progress,omitempty"`
	DurationSeconds *int      `json:"durationSeconds,omitempty"`
	Renditions      []string  `json:"renditions,omitempty"`
	HLSMasterKey    *string   `json:"hlsMasterKey,omitempty"`
	PosterKey       *string   `json:"posterKey,omitempty"`
	ErrorCode       *string   `json:"errorCode,omitempty"`
	Message         *string   `json:"message,omitempty"`
	At              time.Time `json:"at"`
}

// ptr helpers for optional fields.
func strPtr(s string) *string  { return &s }
func intPtr(i int) *int        { return &i }
func f64Ptr(f float64) *float64 { return &f }
