// Package publisher sends transcode status updates to the Redis pub/sub channel.
package publisher

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

const statusChannel = "transcode:status"

// Publisher wraps a Redis client and publishes JSON messages to the
// "transcode:status" pub/sub channel (COMMUNICATION.md §3).
type Publisher struct {
	rdb    *redis.Client
	logger *zap.Logger
}

// New creates a Publisher connected to addr ("host:port").
func New(addr string, logger *zap.Logger) *Publisher {
	rdb := redis.NewClient(&redis.Options{Addr: addr})
	return &Publisher{rdb: rdb, logger: logger}
}

// Publish serialises msg as JSON and PUBLISHes it to the status channel.
// It logs a warning on failure but does not return the error — status updates
// are best-effort; a missed update does not invalidate the transcode result.
func (p *Publisher) Publish(ctx context.Context, msg any) {
	b, err := json.Marshal(msg)
	if err != nil {
		p.logger.Warn("publisher: failed to marshal status message", zap.Error(err))
		return
	}
	n, err := p.rdb.Publish(ctx, statusChannel, string(b)).Result()
	if err != nil {
		p.logger.Warn("publisher: PUBLISH failed", zap.Error(err))
		return
	}
	if n == 0 {
		p.logger.Debug("publisher: no subscribers on status channel (message dropped)")
	}
}

// Close shuts down the underlying Redis connection.
func (p *Publisher) Close() error {
	if err := p.rdb.Close(); err != nil {
		return fmt.Errorf("publisher close: %w", err)
	}
	return nil
}
