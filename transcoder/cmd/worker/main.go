package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"streamflix/transcoder/internal/config"
	"streamflix/transcoder/internal/health"
	applog "streamflix/transcoder/internal/log"
	"streamflix/transcoder/internal/middleware"
	"streamflix/transcoder/internal/probe"
	"streamflix/transcoder/internal/publisher"
	"streamflix/transcoder/internal/storage"
	"streamflix/transcoder/internal/worker"
)

func main() {
	cfg := config.LoadWorker()
	logger := applog.New(cfg.ServiceName)
	defer logger.Sync() //nolint:errcheck

	// ── Storage client ────────────────────────────────────────────────────────
	store, err := storage.New(cfg.S3Endpoint, cfg.S3Key, cfg.S3Secret, cfg.S3Bucket, false)
	if err != nil {
		logger.Fatal("failed to init storage client", zap.Error(err))
	}

	// ── Redis client ──────────────────────────────────────────────────────────
	rdb := redis.NewClient(&redis.Options{
		Addr:         cfg.RedisAddr,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 5 * time.Second,
	})

	// ── Publisher (status pub/sub) ────────────────────────────────────────────
	pub := publisher.New(cfg.RedisAddr, logger)
	defer pub.Close() //nolint:errcheck

	// ── Pipeline + Consumer + Reclaimer ──────────────────────────────────────
	pipeline := worker.NewPipeline(store, pub, logger, "")

	consumerName := consumerID()
	jobTimeout := time.Duration(cfg.JobTimeoutSeconds) * time.Second
	cons := worker.NewConsumer(rdb, pipeline, consumerName, cfg.TranscodeConcurrency, jobTimeout, logger)
	reclaimer := worker.NewReclaimer(rdb, cons, logger)

	// ── Health HTTP server ────────────────────────────────────────────────────
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(
		middleware.Recovery(logger),
		middleware.Correlation(),
		middleware.RequestLogger(logger),
	)
	health.RegisterRoutes(r, cfg.ServiceName, logger,
		health.Check{Name: "redis", Probe: func(ctx context.Context) error {
			return probe.RedisPing(ctx, cfg.RedisAddr)
		}},
		health.Check{Name: "s3", Probe: func(ctx context.Context) error {
			return probe.HTTPOK(ctx, config.MinioHealthURL(cfg.S3Endpoint))
		}},
	)

	srv := &http.Server{
		Addr:              ":" + cfg.HealthPort,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Start health server.
	go func() {
		logger.Info("worker health server listening", zap.String("addr", srv.Addr))
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("health server exited unexpectedly", zap.Error(err))
			stop()
		}
	}()

	// Start reclaimer goroutine.
	go reclaimer.Run(ctx)

	logger.Info("worker started",
		zap.String("consumer", consumerName),
		zap.String("redisAddr", cfg.RedisAddr),
		zap.String("s3Endpoint", cfg.S3Endpoint),
		zap.Int("transcodeConcurrency", cfg.TranscodeConcurrency),
		zap.Int("jobTimeoutSeconds", cfg.JobTimeoutSeconds),
	)

	// Consumer loop — blocks until ctx is cancelled.
	if err := cons.Run(ctx); err != nil {
		logger.Error("consumer exited with error", zap.Error(err))
	}

	// Graceful shutdown.
	logger.Info("worker shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("health server shutdown timed out", zap.Error(err))
	}
	if err := rdb.Close(); err != nil {
		logger.Warn("redis close error", zap.Error(err))
	}
	logger.Info("worker stopped")
}

// consumerID returns a unique name for this worker instance.
// Prefer the hostname (stable in containers) falling back to a timestamp.
func consumerID() string {
	if h, err := os.Hostname(); err == nil && h != "" {
		return fmt.Sprintf("worker-%s", h)
	}
	return fmt.Sprintf("worker-%d", time.Now().UnixNano())
}
