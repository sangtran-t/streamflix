// Package middleware provides Gin middleware for the Go services.
package middleware

import (
	"crypto/rand"
	"encoding/hex"

	"github.com/gin-gonic/gin"

	applog "streamflix/transcoder/internal/log"
)

const CorrelationHeader = "X-Correlation-Id"

// Correlation reads X-Correlation-Id from the request or mints a fresh ID,
// binds it to the request context, and echoes it on the response.
func Correlation() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader(CorrelationHeader)
		if id == "" {
			id = newID()
		}
		ctx := applog.WithCorrelation(c.Request.Context(), id)
		c.Request = c.Request.WithContext(ctx)
		c.Set("correlationId", id)
		c.Header(CorrelationHeader, id)
		c.Next()
	}
}

func newID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "unknown"
	}
	return hex.EncodeToString(b)
}
