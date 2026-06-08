// Package storage provides a thin S3/MinIO client for the delivery edge.
// It wraps minio-go to fetch objects and stream them to HTTP clients.
package storage

import (
	"context"
	"fmt"
	"io"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// Client wraps a MinIO/S3 connection.
type Client struct {
	mc     *minio.Client
	bucket string
}

// New creates a Client connected to endpoint using key/secret.
// endpoint should be the host:port (or full URL) of the MinIO/S3 server.
// useSSL should be true for HTTPS endpoints (false for local MinIO dev).
func New(endpoint, key, secret, bucket string, useSSL bool) (*Client, error) {
	// minio-go expects endpoint without scheme; strip it if present.
	host := stripScheme(endpoint)
	mc, err := minio.New(host, &minio.Options{
		Creds:  credentials.NewStaticV4(key, secret, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("storage: init client: %w", err)
	}
	return &Client{mc: mc, bucket: bucket}, nil
}

// GetObject fetches key from the configured bucket and returns a
// ReadCloser. The caller is responsible for closing it.
func (c *Client) GetObject(ctx context.Context, key string) (io.ReadCloser, int64, error) {
	obj, err := c.mc.GetObject(ctx, c.bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, 0, fmt.Errorf("storage: GetObject %q: %w", key, err)
	}
	info, err := obj.Stat()
	if err != nil {
		obj.Close()
		return nil, 0, fmt.Errorf("storage: Stat %q: %w", key, err)
	}
	return obj, info.Size, nil
}

// stripScheme removes "http://" or "https://" prefix from a URL.
func stripScheme(endpoint string) string {
	for _, prefix := range []string{"https://", "http://"} {
		if len(endpoint) > len(prefix) && endpoint[:len(prefix)] == prefix {
			return endpoint[len(prefix):]
		}
	}
	return endpoint
}
