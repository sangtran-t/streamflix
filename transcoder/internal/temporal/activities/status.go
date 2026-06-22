package activities

import (
	"context"
	"time"

	"go.uber.org/zap"

	"streamflix/transcoder/internal/publisher"
	"streamflix/transcoder/internal/worker"
)

const schemaVersion = "1.1"

// StatusActivities groups the activities that publish job status updates
// over Redis Pub/Sub. Each method is a single, idempotent publish call that
// Temporal can safely retry on transient Redis failures.
type StatusActivities struct {
	publisher *publisher.Publisher
	logger    *zap.Logger
}

// NewStatusActivities creates a StatusActivities backed by pub.
func NewStatusActivities(pub *publisher.Publisher, logger *zap.Logger) *StatusActivities {
	return &StatusActivities{publisher: pub, logger: logger}
}

// PublishProcessing publishes status="processing" for the given job.
func (a *StatusActivities) PublishProcessing(ctx context.Context, job worker.TranscodeJob) error {
	msg := worker.StatusMessage{
		SchemaVersion: schemaVersion,
		AssetID:       job.AssetID,
		CorrelationID: job.CorrelationID,
		Status:        "processing",
		At:            time.Now().UTC(),
	}
	a.publisher.Publish(ctx, msg)
	a.logger.Info("status published",
		zap.String("status", "processing"),
		zap.String("assetId", job.AssetID),
		zap.String("correlationId", job.CorrelationID),
	)
	return nil
}

// PublishReady publishes status="ready" with the full transcode result.
func (a *StatusActivities) PublishReady(ctx context.Context, job worker.TranscodeJob, result TranscodeResult) error {
	msg := worker.StatusMessage{
		SchemaVersion:   schemaVersion,
		AssetID:         job.AssetID,
		CorrelationID:   job.CorrelationID,
		Status:          "ready",
		DurationSeconds: intPtr(result.DurationSeconds),
		Renditions:      result.Renditions,
		HLSMasterKey:    strPtr(result.MasterKey),
		At:              time.Now().UTC(),
	}
	if result.PosterKey != "" {
		msg.PosterKey = strPtr(result.PosterKey)
	}
	a.publisher.Publish(ctx, msg)
	a.logger.Info("status published",
		zap.String("status", "ready"),
		zap.String("assetId", job.AssetID),
		zap.String("correlationId", job.CorrelationID),
		zap.String("masterKey", result.MasterKey),
	)
	return nil
}

// PublishFailed publishes status="failed" with the given error code and detail.
func (a *StatusActivities) PublishFailed(ctx context.Context, job worker.TranscodeJob, errorCode, detail string) error {
	msg := worker.StatusMessage{
		SchemaVersion: schemaVersion,
		AssetID:       job.AssetID,
		CorrelationID: job.CorrelationID,
		Status:        "failed",
		ErrorCode:     strPtr(errorCode),
		Message:       strPtr(detail),
		At:            time.Now().UTC(),
	}
	a.publisher.Publish(ctx, msg)
	a.logger.Warn("status published",
		zap.String("status", "failed"),
		zap.String("assetId", job.AssetID),
		zap.String("correlationId", job.CorrelationID),
		zap.String("errorCode", errorCode),
	)
	return nil
}

func strPtr(s string) *string { return &s }
func intPtr(i int) *int       { return &i }
