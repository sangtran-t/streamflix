package config

// EdgeConfig holds runtime configuration for the delivery edge service.
// Do NOT log S3Secret or SigningSecret.
type EdgeConfig struct {
	ServiceName   string
	Port          string
	S3Endpoint    string
	S3Key         string
	S3Secret      string
	S3Bucket      string
	SigningSecret string
}

func LoadEdge() EdgeConfig {
	v := newViper()
	v.SetDefault("service_name", "edge")
	v.SetDefault("edge_port", "8081")

	return EdgeConfig{
		ServiceName:   v.GetString("service_name"),
		Port:          v.GetString("edge_port"),
		S3Endpoint:    v.GetString("s3_endpoint"),
		S3Key:         v.GetString("s3_key"),
		S3Secret:      v.GetString("s3_secret"),
		S3Bucket:      v.GetString("s3_bucket"),
		SigningSecret: v.GetString("signing_secret"),
	}
}
