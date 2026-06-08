package health

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	applog "streamflix/transcoder/internal/log"
)

// Check is a named dependency probe (e.g. "redis", "s3").
type Check struct {
	Name  string
	Probe func(ctx context.Context) error
}

// RegisterRoutes adds GET /healthz and GET /readyz to r.
func RegisterRoutes(r gin.IRouter, service string, logger *zap.Logger, checks ...Check) {
	r.GET("/healthz", liveness(service))
	r.GET("/readyz", readiness(logger, checks))
}

func liveness(service string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "service": service})
	}
}

// readiness runs all probes concurrently with a 3s deadline.
// Returns 200 when all pass, 503 otherwise.
func readiness(logger *zap.Logger, checks []Check) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
		defer cancel()

		results := make(map[string]string, len(checks))
		allUp := true
		var mu sync.Mutex
		var wg sync.WaitGroup

		for _, ch := range checks {
			wg.Add(1)
			go func(ch Check) {
				defer wg.Done()
				state := "up"
				if err := ch.Probe(ctx); err != nil {
					state = "down"
					applog.FromContext(ctx, logger).Warn("readiness check failed",
						zap.String("check", ch.Name),
						zap.Error(err),
					)
				}
				mu.Lock()
				results[ch.Name] = state
				if state == "down" {
					allUp = false
				}
				mu.Unlock()
			}(ch)
		}
		wg.Wait()

		status := http.StatusOK
		body := "ready"
		if !allUp {
			status = http.StatusServiceUnavailable
			body = "not-ready"
		}
		c.JSON(status, gin.H{"status": body, "checks": results})
	}
}
