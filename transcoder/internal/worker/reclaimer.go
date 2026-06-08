package worker

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

const (
	// visibilityTimeout is how long a message must be idle before a reclaimer
	// considers the consumer dead and claims the job (COMMUNICATION.md §1).
	visibilityTimeout = 120 * time.Second
	// reclaimerInterval controls how often the reclaimer sweeps for stuck jobs.
	reclaimerInterval = 30 * time.Second
)

// Reclaimer periodically sweeps the pending-entry list for messages that have
// been idle longer than visibilityTimeout (i.e. the worker that picked them up
// crashed). It re-delivers them to a healthy consumer, or dead-letters them
// after maxRetries attempts.
type Reclaimer struct {
	rdb      *redis.Client
	consumer *Consumer
	logger   *zap.Logger
}

// NewReclaimer creates a Reclaimer backed by the same Redis client and consumer.
func NewReclaimer(rdb *redis.Client, consumer *Consumer, logger *zap.Logger) *Reclaimer {
	return &Reclaimer{rdb: rdb, consumer: consumer, logger: logger}
}

// Run starts the reclaim sweep loop. It blocks until ctx is cancelled.
func (r *Reclaimer) Run(ctx context.Context) {
	ticker := time.NewTicker(reclaimerInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			r.sweep(ctx)
		}
	}
}

func (r *Reclaimer) sweep(ctx context.Context) {
	// XPENDING: list all pending messages idle > visibilityTimeout.
	pending, err := r.rdb.XPendingExt(ctx, &redis.XPendingExtArgs{
		Stream: streamName,
		Group:  consumerGroup,
		Idle:   visibilityTimeout,
		Start:  "-",
		End:    "+",
		Count:  100,
	}).Result()
	if err != nil {
		r.logger.Warn("reclaimer: XPENDING failed", zap.Error(err))
		return
	}

	for _, p := range pending {
		deliveries := retryCount(p.RetryCount)
		if deliveries >= maxRetries {
			r.logger.Warn("reclaimer: dead-lettering after max retries",
				zap.String("id", p.ID),
				zap.Int("deliveries", deliveries),
			)
			r.claimAndDeadLetter(ctx, p)
			continue
		}

		// XCLAIM — re-assign to this reclaimer's consumer so the main loop
		// picks it up again on the next XREADGROUP with ">" (pending only).
		// We claim it to ourselves; the next Run() iteration will pick it up
		// via XPENDING re-delivery (delivery count > 0 entries are returned
		// by XREADGROUP with "0" start, not ">"). Instead, we re-dispatch
		// directly from here so it doesn't wait for the next XREADGROUP cycle.
		claimed, err := r.rdb.XClaim(ctx, &redis.XClaimArgs{
			Stream:   streamName,
			Group:    consumerGroup,
			Consumer: r.consumer.name,
			MinIdle:  visibilityTimeout,
			Messages: []string{p.ID},
		}).Result()
		if err != nil {
			r.logger.Warn("reclaimer: XCLAIM failed",
				zap.String("id", p.ID),
				zap.Error(err),
			)
			continue
		}

		for _, m := range claimed {
			r.logger.Info("reclaimer: reclaimed job",
				zap.String("id", m.ID),
				zap.Int("deliveries", deliveries+1),
			)
			// Re-dispatch directly so it runs immediately rather than waiting
			// for the next XREADGROUP poll.
			go r.consumer.handleMessage(ctx, m)
		}
	}
}

func (r *Reclaimer) claimAndDeadLetter(ctx context.Context, p redis.XPendingExt) {
	// Claim the message so we own it, then ACK + dead-letter it.
	claimed, err := r.rdb.XClaim(ctx, &redis.XClaimArgs{
		Stream:   streamName,
		Group:    consumerGroup,
		Consumer: r.consumer.name,
		MinIdle:  visibilityTimeout,
		Messages: []string{p.ID},
	}).Result()
	if err != nil {
		r.logger.Warn("reclaimer: XCLAIM for dead-letter failed",
			zap.String("id", p.ID),
			zap.Error(err),
		)
		return
	}
	for _, m := range claimed {
		r.consumer.deadLetter(ctx, m, "MAX_RETRIES_EXCEEDED",
			"job exceeded max delivery attempts after worker crash",
		)
		r.consumer.ack(ctx, m.ID)
	}
}
