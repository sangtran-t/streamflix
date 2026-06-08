// Package hls provides the gin handler for the HLS delivery endpoint.
//
// Route: GET /hls/*path
//
// Flow:
//  1. Extract assetId from the first path segment after /hls/.
//  2. Read the sf_play cookie and call internal/auth.VerifyCookie.
//  3. On success, fetch the object from object storage and stream it back
//     with the appropriate Content-Type.
//  4. On auth failure: 401 (missing/malformed) or 403 (expired/asset mismatch).
//
// See COMMUNICATION.md §4 for the full cookie/signature spec.
package hls

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"path"
	"strings"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"streamflix/transcoder/internal/auth"
	"streamflix/transcoder/internal/storage"
)

// Handler holds dependencies for the HLS delivery handler.
type Handler struct {
	store         *storage.Client
	signingSecret string
	logger        *zap.Logger
}

// New creates a Handler.
func New(store *storage.Client, signingSecret string, logger *zap.Logger) *Handler {
	return &Handler{store: store, signingSecret: signingSecret, logger: logger}
}

// ServeHLS handles GET /hls/*path.
func (h *Handler) ServeHLS(c *gin.Context) {
	// rawPath starts with "/" e.g. "/20000000-.../master.m3u8"
	rawPath := c.Param("path")
	trimmed := strings.TrimPrefix(rawPath, "/")
	slash := strings.IndexByte(trimmed, '/')
	if slash < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid HLS path"})
		return
	}
	assetId := trimmed[:slash]
	rest := trimmed[slash+1:]
	if rest == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid HLS path"})
		return
	}
	objectKey := "hls/" + assetId + "/" + rest

	// --- Cookie auth ---
	cookieValue, _ := c.Cookie("sf_play") // empty string if absent

	userId, authErr := auth.VerifyCookie(h.signingSecret, cookieValue, assetId)
	if authErr != nil {
		h.logger.Debug("playback auth failed",
			zap.String("assetId", assetId),
			zap.Error(authErr),
		)
		if errors.Is(authErr, auth.ErrMissing) || errors.Is(authErr, auth.ErrMalformed) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": authErr.Error()})
		} else {
			c.JSON(http.StatusForbidden, gin.H{"error": authErr.Error()})
		}
		return
	}

	h.logger.Debug("serving HLS",
		zap.String("userId", userId),
		zap.String("assetId", assetId),
		zap.String("key", objectKey),
	)

	// --- Fetch from object storage ---
	ctx := c.Request.Context()
	rc, size, fetchErr := h.store.GetObject(ctx, objectKey)
	if fetchErr != nil {
		h.logger.Error("storage fetch failed", zap.String("key", objectKey), zap.Error(fetchErr))
		errMsg := fetchErr.Error()
		if strings.Contains(errMsg, "NoSuchKey") ||
			strings.Contains(errMsg, "not found") ||
			strings.Contains(errMsg, "does not exist") {
			c.JSON(http.StatusNotFound, gin.H{"error": "segment not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "storage error"})
		}
		return
	}
	defer rc.Close()

	// --- Stream response ---
	contentType := contentTypeFor(objectKey)
	c.Header("Content-Type", contentType)
	if size > 0 {
		c.Header("Content-Length", fmt.Sprintf("%d", size))
	}
	// Manifests must not be cached; segments may be cached by the CDN/browser.
	if strings.HasSuffix(objectKey, ".m3u8") {
		c.Header("Cache-Control", "no-cache, no-store")
	} else {
		c.Header("Cache-Control", "public, max-age=86400")
	}

	c.Status(http.StatusOK)
	if _, err := io.Copy(c.Writer, rc); err != nil {
		h.logger.Warn("stream copy interrupted", zap.String("key", objectKey), zap.Error(err))
	}
}

func contentTypeFor(key string) string {
	switch path.Ext(key) {
	case ".m3u8":
		return "application/vnd.apple.mpegurl"
	case ".ts":
		return "video/MP2T"
	case ".m4s", ".mp4":
		return "video/mp4"
	default:
		return "application/octet-stream"
	}
}
