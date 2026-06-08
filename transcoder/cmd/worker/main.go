package main

import (
	"context"
	"errors"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"streamflix/transcoder/internal/config"
	"streamflix/transcoder/internal/health"
	applog "streamflix/transcoder/internal/log"
	"streamflix/transcoder/internal/middleware"
	"streamflix/transcoder/internal/probe"
)

func main() {
	cfg := config.LoadWorker()
	logger := applog.New(cfg.ServiceName)
	defer logger.Sync() //nolint:errcheck

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

	go func() {
		logger.Info("worker health server listening", zap.String("addr", srv.Addr))
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("health server exited unexpectedly", zap.Error(err))
			stop()
		}
	}()

	logger.Info("worker started",
		zap.String("redisAddr", cfg.RedisAddr),
		zap.String("s3Endpoint", cfg.S3Endpoint),
		zap.Int("transcodeConcurrency", cfg.TranscodeConcurrency),
		zap.Int("jobTimeoutSeconds", cfg.JobTimeoutSeconds),
	)

	<-ctx.Done()
	logger.Info("worker shutting down")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown timed out", zap.Error(err))
	}
	logger.Info("worker stopped")
}
