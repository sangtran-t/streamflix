// Package probe provides lightweight dependency reachability checks for readiness endpoints.
package probe

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisPing pings Redis at addr ("host:port").
func RedisPing(ctx context.Context, addr string) error {
	rdb := redis.NewClient(&redis.Options{
		Addr:         addr,
		DialTimeout:  2 * time.Second,
		ReadTimeout:  2 * time.Second,
		WriteTimeout: 2 * time.Second,
	})
	defer rdb.Close()

	if err := rdb.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("redis ping %s: %w", addr, err)
	}
	return nil
}

// HTTPOK issues a GET and treats any 2xx response as healthy.
func HTTPOK(ctx context.Context, url string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("probe %s: build request: %w", url, err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("probe %s: %w", url, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("probe %s: unexpected status %d", url, resp.StatusCode)
	}
	return nil
}
