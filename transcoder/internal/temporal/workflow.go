// Package temporalflow defines the Temporal workflow that orchestrates the
// StreamFlix transcode pipeline. The package name differs from the directory
// name ("temporal") to avoid collision with the go.temporal.io/sdk/temporal
// error-types package used by callers.
package temporalflow

import (
	"errors"
	"time"

	sdktemporal "go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"

	"streamflix/transcoder/internal/temporal/activities"
	"streamflix/transcoder/internal/worker"
)

// TranscodeWorkflow orchestrates the full transcode pipeline:
//
//	PublishProcessing → RunTranscode → PublishReady
//	                              ↘ (on error) → PublishFailed
//
// Activity options encode the SLA contract:
//   - Status publishes: short timeout (15 s), up to 5 retries.
//   - Transcode: 30-minute window, heartbeat every 30 s (detects stuck workers),
//     up to 3 retries, FFMPEG_NONZERO is non-retryable.
func TranscodeWorkflow(ctx workflow.Context, job worker.TranscodeJob) error {
	log := workflow.GetLogger(ctx)

	// Activity options for short status-publish steps.
	statusOpts := workflow.ActivityOptions{
		StartToCloseTimeout: 15 * time.Second,
		RetryPolicy: &sdktemporal.RetryPolicy{
			MaximumAttempts: 5,
		},
	}
	sCtx := workflow.WithActivityOptions(ctx, statusOpts)

	// Activity options for the long-running transcode step.
	transcodeOpts := workflow.ActivityOptions{
		StartToCloseTimeout: 4 * time.Hour,
		HeartbeatTimeout:    30 * time.Second,
		RetryPolicy: &sdktemporal.RetryPolicy{
			MaximumAttempts:        3,
			NonRetryableErrorTypes: []string{"FFMPEG_NONZERO"},
		},
	}
	tCtx := workflow.WithActivityOptions(ctx, transcodeOpts)

	// Temporal requires nil pointer receivers for deterministic activity registration.
	var sa *activities.StatusActivities
	var ta *activities.TranscodeActivities

	// 1. Publish "processing" — best-effort; we proceed even if Redis is
	//    temporarily unavailable so we don't block the actual transcode.
	if err := workflow.ExecuteActivity(sCtx, sa.PublishProcessing, job).Get(sCtx, nil); err != nil {
		log.Warn("PublishProcessing failed (non-fatal), continuing",
			"error", err,
			"assetId", job.AssetID,
		)
	}

	// 2. Run the transcode — this is the critical path.
	var result activities.TranscodeResult
	if err := workflow.ExecuteActivity(tCtx, ta.RunTranscode, job).Get(tCtx, &result); err != nil {
		log.Error("RunTranscode failed",
			"error", err,
			"assetId", job.AssetID,
			"correlationId", job.CorrelationID,
		)

		// Extract the Temporal ApplicationError type as the error code so the
		// NestJS consumer can distinguish FFMPEG_NONZERO from generic failures.
		errorCode := "TRANSCODE_FAILED"
		var appErr *sdktemporal.ApplicationError
		if errors.As(err, &appErr) && appErr.Type() != "" {
			errorCode = appErr.Type()
		}

		// Publish "failed" — best-effort; log and swallow if it fails.
		if pubErr := workflow.ExecuteActivity(sCtx, sa.PublishFailed, job, errorCode, err.Error()).Get(sCtx, nil); pubErr != nil {
			log.Warn("PublishFailed activity failed (non-fatal)",
				"error", pubErr,
				"assetId", job.AssetID,
			)
		}

		return err
	}

	// 3. Publish "ready" — best-effort; the transcode has already succeeded
	//    so we don't want to fail the workflow over a Redis blip.
	if err := workflow.ExecuteActivity(sCtx, sa.PublishReady, job, result).Get(sCtx, nil); err != nil {
		log.Warn("PublishReady failed (non-fatal), job data is in MinIO",
			"error", err,
			"assetId", job.AssetID,
			"masterKey", result.MasterKey,
		)
	}

	log.Info("workflow complete",
		"assetId", job.AssetID,
		"masterKey", result.MasterKey,
		"durationSeconds", result.DurationSeconds,
	)
	return nil
}
