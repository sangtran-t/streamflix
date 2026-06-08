package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

const (
	streamName    = "transcode:jobs"
	consumerGroup = "transcoders"
	deadLetterKey = "transcode:jobs:dead"
	maxRetries    = 3
)

// Consumer reads jobs from the Redis Stream using XREADGROUP and dispatches
// them to the Pipeline with bounded concurrency.
type Consumer struct {
	rdb        *redis.Client
	pipeline   *Pipeline
	name       string // unique consumer name within the group
	concur     int    // max concurrent jobs (semaphore capacity)
	jobTimeout time.Duration
	logger     *zap.Logger
}

// NewConsumer creates a Consumer. consumerName must be unique per worker
// instance (e.g. hostname or a UUID).
func NewConsumer(
	rdb *redis.Client,
	pipeline *Pipeline,
	consumerName string,
	concurrency int,
	jobTimeout time.Duration,
	logger *zap.Logger,
) *Consumer {
	return &Consumer{
		rdb:        rdb,
		pipeline:   pipeline,
		name:       consumerName,
		concur:     concurrency,
		jobTimeout: jobTimeout,
		logger:     logger,
	}
}

// Run starts the consumer loop, blocking until ctx is cancelled.
// It uses a semaphore channel to bound concurrent jobs to c.concur.
func (c *Consumer) Run(ctx context.Context) error {
	// Ensure consumer group exists (idempotent — BUSYGROUP is ignored).
	if err := c.ensureGroup(ctx); err != nil {
		return fmt.Errorf("consumer: ensure group: %w", err)
	}

	sem := make(chan struct{}, c.concur) // semaphore

	for {
		select {
		case <-ctx.Done():
			return nil
		default:
		}

		msgs, err := c.rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    consumerGroup,
			Consumer: c.name,
			Streams:  []string{streamName, ">"},
			Count:    1,
			Block:    5 * time.Second,
		}).Result()

		if err != nil {
			if err == redis.Nil || err.Error() == "redis: nil" {
				continue // timeout, no message — loop
			}
			if ctx.Err() != nil {
				return nil // context cancelled during block
			}
			c.logger.Warn("XREADGROUP error", zap.Error(err))
			time.Sleep(time.Second)
			continue
		}

		for _, stream := range msgs {
			for _, msg := range stream.Messages {
				sem <- struct{}{} // acquire slot
				go func(m redis.XMessage) {
					defer func() { <-sem }() // release slot
					c.handleMessage(ctx, m)
				}(msg)
			}
		}
	}
}

func (c *Consumer) handleMessage(ctx context.Context, m redis.XMessage) {
	log := c.logger.With(zap.String("streamId", m.ID))

	job, err := parseJob(m.Values)
	if err != nil {
		log.Error("failed to parse job message — dead-lettering", zap.Error(err))
		c.deadLetter(ctx, m, "PARSE_ERROR", err.Error())
		c.ack(ctx, m.ID)
		return
	}
	log = log.With(zap.String("assetId", job.AssetID), zap.String("correlationId", job.CorrelationID))

	// Per-job timeout (B1).
	jobCtx, cancel := context.WithTimeout(ctx, c.jobTimeout)
	defer cancel()

	if err := c.pipeline.Run(jobCtx, job); err != nil {
		log.Error("pipeline failed", zap.Error(err))
		// Pipeline already published "failed" status; just ACK so this stream
		// entry doesn't get reclaimed and re-run (it's a permanent failure at
		// this point). The dead-letter path is used for reclaim retries (see
		// reclaimer.go), not for pipeline errors.
		c.ack(ctx, m.ID)
		return
	}

	c.ack(ctx, m.ID)
}

func (c *Consumer) ack(ctx context.Context, id string) {
	if err := c.rdb.XAck(ctx, streamName, consumerGroup, id).Err(); err != nil {
		c.logger.Warn("XACK failed", zap.String("id", id), zap.Error(err))
	}
}

func (c *Consumer) deadLetter(ctx context.Context, m redis.XMessage, code, detail string) {
	fields := make(map[string]any, len(m.Values)+3)
	for k, v := range m.Values {
		fields[k] = v
	}
	fields["_deadReason"] = code
	fields["_deadDetail"] = detail
	fields["_deadAt"] = time.Now().UTC().Format(time.RFC3339)
	if err := c.rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: deadLetterKey,
		Values: fields,
	}).Err(); err != nil {
		c.logger.Warn("dead-letter XADD failed", zap.Error(err))
	}
}

func (c *Consumer) ensureGroup(ctx context.Context) error {
	err := c.rdb.XGroupCreateMkStream(ctx, streamName, consumerGroup, "$").Err()
	if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
		return err
	}
	return nil
}

// parseJob decodes the flat Redis Stream message values into a TranscodeJob.
// Stream values arrive as map[string]any (strings after round-trip through Redis).
func parseJob(values map[string]any) (TranscodeJob, error) {
	// Re-serialise to JSON so we can use standard json.Unmarshal.
	// This is the simplest correct approach for the flat key/value format.
	m := make(map[string]string, len(values))
	for k, v := range values {
		m[k] = fmt.Sprintf("%v", v)
	}

	// Build a JSON object from the flat fields.
	payload := map[string]any{
		"schemaVersion": m["schemaVersion"],
		"jobId":         m["jobId"],
		"assetId":       m["assetId"],
		"correlationId": m["correlationId"],
		"inputKey":      m["inputKey"],
		"title":         m["title"],
		"requestedAt":   m["requestedAt"],
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return TranscodeJob{}, fmt.Errorf("marshal: %w", err)
	}
	var job TranscodeJob
	if err := json.Unmarshal(b, &job); err != nil {
		return TranscodeJob{}, fmt.Errorf("unmarshal: %w", err)
	}
	return job, nil
}

// retryCount extracts the delivery count from a pending entry's idle info.
// Used by the reclaimer to decide when to dead-letter.
func retryCount(deliveryCount int64) int {
	return int(deliveryCount)
}

// idleMillis converts a duration to the integer milliseconds expected by XCLAIM.
func idleMillis(d time.Duration) int64 {
	return d.Milliseconds()
}

// parseInt64 is a safe string→int64 helper used in reclaimer pending parsing.
func parseInt64(s string) int64 {
	n, _ := strconv.ParseInt(s, 10, 64)
	return n
}
