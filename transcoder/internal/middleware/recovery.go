package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	applog "streamflix/transcoder/internal/log"
)

// Recovery returns a Gin middleware that catches panics, logs them with Zap
// (including the correlationId from ctx), and returns HTTP 500. Ensures the
// server remains up after an unexpected runtime error.
func Recovery(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				applog.FromContext(c.Request.Context(), logger).Error("panic recovered",
					zap.Any("panic", r),
					zap.String("method", c.Request.Method),
					zap.String("path", c.Request.URL.Path),
				)
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"status": "error",
					"error":  "internal server error",
				})
			}
		}()
		c.Next()
	}
}
