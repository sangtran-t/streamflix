// Package log provides a structured JSON logger backed by go.uber.org/zap.
package log

import (
	"context"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

type contextKey struct{}

// New returns a production JSON Zap logger tagged with the given service name.
func New(service string) *zap.Logger {
	cfg := zap.NewProductionConfig()
	cfg.EncoderConfig.TimeKey = "ts"
	cfg.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	cfg.EncoderConfig.LevelKey = "level"
	cfg.EncoderConfig.MessageKey = "msg"
	cfg.EncoderConfig.CallerKey = zapcore.OmitKey

	logger, err := cfg.Build(zap.Fields(zap.String("service", service)))
	if err != nil {
		panic("log.New: failed to initialise logger: " + err.Error())
	}
	return logger
}

// WithCorrelation stores a correlationId on ctx for propagation across async boundaries.
func WithCorrelation(ctx context.Context, correlationID string) context.Context {
	return context.WithValue(ctx, contextKey{}, correlationID)
}

// FromContext returns base annotated with the correlationId from ctx, if present.
func FromContext(ctx context.Context, base *zap.Logger) *zap.Logger {
	if id, ok := ctx.Value(contextKey{}).(string); ok && id != "" {
		return base.With(zap.String("correlationId", id))
	}
	return base
}

// CorrelationFromContext extracts the correlationId string from ctx.
func CorrelationFromContext(ctx context.Context) string {
	if id, ok := ctx.Value(contextKey{}).(string); ok {
		return id
	}
	return ""
}
