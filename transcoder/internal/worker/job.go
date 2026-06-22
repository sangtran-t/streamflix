// Package worker defines the shared schema types for transcode jobs and status messages.
package worker

import "time"

// TranscodeJob is the workflow input schema for TranscodeWorkflow.
// Nest passes this as the first argument when starting the workflow via Temporal.
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

func strPtr(s string) *string { return &s }
func intPtr(i int) *int       { return &i }
