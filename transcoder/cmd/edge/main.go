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
	"streamflix/transcoder/internal/hls"
	applog "streamflix/transcoder/internal/log"
	"streamflix/transcoder/internal/middleware"
	"streamflix/transcoder/internal/probe"
	"streamflix/transcoder/internal/storage"
)

func main() {
	cfg := config.LoadEdge()
	logger := applog.New(cfg.ServiceName)
	defer logger.Sync() //nolint:errcheck

	store, err := storage.New(cfg.S3Endpoint, cfg.S3Key, cfg.S3Secret, cfg.S3Bucket, false)
	if err != nil {
		logger.Fatal("failed to init storage client", zap.Error(err))
	}

	hlsHandler := hls.New(store, cfg.SigningSecret, logger)

	gin.SetMode(gin.ReleaseMode)

	r := gin.New()
	r.Use(
		middleware.Recovery(logger),
		middleware.Correlation(),
		middleware.RequestLogger(logger),
	)

	health.RegisterRoutes(r, cfg.ServiceName, logger,
		health.Check{Name: "s3", Probe: func(ctx context.Context) error {
			return probe.HTTPOK(ctx, config.MinioHealthURL(cfg.S3Endpoint))
		}},
	)

	r.GET("/hls/*path", hlsHandler.ServeHLS)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		logger.Info("edge listening", zap.String("addr", srv.Addr))
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("edge server exited unexpectedly", zap.Error(err))
			stop()
		}
	}()

	<-ctx.Done()
	logger.Info("edge shutting down")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown timed out", zap.Error(err))
	}
	logger.Info("edge stopped")
}
