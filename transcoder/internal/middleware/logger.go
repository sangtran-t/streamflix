package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	applog "streamflix/transcoder/internal/log"
)

// RequestLogger returns a Gin middleware that emits one structured log entry per
// request with Zap. Fields: method, path, status, latency, clientIP, correlationId.
// Must be registered after Correlation() so the correlationId is already in ctx.
func RequestLogger(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		applog.FromContext(c.Request.Context(), logger).Info("request",
			zap.String("method", c.Request.Method),
			zap.String("path", c.FullPath()),
			zap.Int("status", c.Writer.Status()),
			zap.Duration("latency", time.Since(start)),
			zap.String("clientIP", c.ClientIP()),
		)
	}
}
