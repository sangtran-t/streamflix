package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	temporalsdk "go.temporal.io/sdk/client"
	temporalworker "go.temporal.io/sdk/worker"
	"go.uber.org/zap"

	"streamflix/transcoder/internal/config"
	"streamflix/transcoder/internal/health"
	applog "streamflix/transcoder/internal/log"
	"streamflix/transcoder/internal/middleware"
	"streamflix/transcoder/internal/probe"
	"streamflix/transcoder/internal/publisher"
	"streamflix/transcoder/internal/storage"
	temporalflow "streamflix/transcoder/internal/temporal"
	"streamflix/transcoder/internal/temporal/activities"
)

func main() {
	cfg := config.LoadWorker()
	logger := applog.New(cfg.ServiceName)
	defer logger.Sync() //nolint:errcheck
	store, err := storage.New(cfg.S3Endpoint, cfg.S3Key, cfg.S3Secret, cfg.S3Bucket, false)
	if err != nil {
		logger.Fatal("failed to init storage client", zap.Error(err))
	}
	pub := publisher.New(cfg.RedisAddr, logger)
	defer pub.Close() //nolint:errcheck
	transcodeActs := activities.NewTranscodeActivities(store, logger, "")
	statusActs := activities.NewStatusActivities(pub, logger)
	temporalClient, err := temporalsdk.Dial(temporalsdk.Options{
		HostPort:  cfg.TemporalAddr,
		Namespace: "default",
	})
	if err != nil {
		logger.Fatal("failed to connect to Temporal", zap.String("addr", cfg.TemporalAddr), zap.Error(err))
	}
	defer temporalClient.Close()
	w := temporalworker.New(temporalClient, cfg.TaskQueue, temporalworker.Options{
		MaxConcurrentActivityExecutionSize: cfg.TranscodeConcurrency,
	})
	w.RegisterWorkflow(temporalflow.TranscodeWorkflow)
	w.RegisterActivity(transcodeActs)
	w.RegisterActivity(statusActs)

	if err := w.Start(); err != nil {
		logger.Fatal("failed to start Temporal worker", zap.Error(err))
	}
	defer w.Stop()
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
		zap.String("workerID", workerID()),
		zap.String("temporalAddr", cfg.TemporalAddr),
		zap.String("taskQueue", cfg.TaskQueue),
		zap.String("redisAddr", cfg.RedisAddr),
		zap.String("s3Endpoint", cfg.S3Endpoint),
		zap.Int("transcodeConcurrency", cfg.TranscodeConcurrency),
	)

	<-ctx.Done()

	logger.Info("worker shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("health server shutdown timed out", zap.Error(err))
	}
	logger.Info("worker stopped")
}

func workerID() string {
	if h, err := os.Hostname(); err == nil && h != "" {
		return "worker-" + h
	}
	return "worker-unknown"
}
