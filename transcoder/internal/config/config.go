// Package config loads service configuration from environment variables via Viper.
package config

import (
	"strings"

	"github.com/spf13/viper"
)

func newViper() *viper.Viper {
	v := viper.New()
	v.AutomaticEnv()
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_", "-", "_"))
	return v
}

// MinioHealthURL builds the MinIO liveness probe URL from the S3 endpoint base.
func MinioHealthURL(endpoint string) string {
	return strings.TrimRight(endpoint, "/") + "/minio/health/live"
}
