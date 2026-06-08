package health

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func init() {
	// Silence Gin debug output.
	gin.SetMode(gin.TestMode)
}

// newRouter creates a minimal Gin engine with the health routes registered.
func newRouter(service string, checks ...Check) *gin.Engine {
	r := gin.New()
	RegisterRoutes(r, service, zap.NewNop(), checks...)
	return r
}

func TestHealthzAlwaysOK(t *testing.T) {
	r := newRouter("worker")
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("healthz: got %d, want 200", rec.Code)
	}
	var body struct {
		Status  string `json:"status"`
		Service string `json:"service"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Status != "ok" || body.Service != "worker" {
		t.Fatalf("unexpected body: %+v", body)
	}
}

func TestReadyzReadyWhenAllChecksPass(t *testing.T) {
	r := newRouter("worker",
		Check{Name: "redis", Probe: func(context.Context) error { return nil }},
		Check{Name: "s3", Probe: func(context.Context) error { return nil }},
	)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/readyz", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("readyz: got %d, want 200", rec.Code)
	}
	var body struct {
		Status string            `json:"status"`
		Checks map[string]string `json:"checks"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Status != "ready" || body.Checks["redis"] != "up" || body.Checks["s3"] != "up" {
		t.Fatalf("unexpected body: %+v", body)
	}
}

func TestReadyzNotReadyWhenACheckFails(t *testing.T) {
	r := newRouter("edge",
		Check{Name: "s3", Probe: func(context.Context) error { return errors.New("unreachable") }},
	)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/readyz", nil))

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("readyz: got %d, want 503", rec.Code)
	}
	var body struct {
		Status string            `json:"status"`
		Checks map[string]string `json:"checks"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Status != "not-ready" || body.Checks["s3"] != "down" {
		t.Fatalf("unexpected body: %+v", body)
	}
}
