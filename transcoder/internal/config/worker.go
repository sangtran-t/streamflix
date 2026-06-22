package config

// WorkerConfig holds runtime configuration for the transcode worker service.
// Do NOT log S3Secret.
type WorkerConfig struct {
	ServiceName          string
	HealthPort           string
	RedisAddr            string // still needed for Redis Pub/Sub status publishing
	TemporalAddr         string
	TaskQueue            string
	S3Endpoint           string
	S3Key                string
	S3Secret             string
	S3Bucket             string
	TranscodeConcurrency int
}

func LoadWorker() WorkerConfig {
	v := newViper()
	v.SetDefault("service_name", "worker")
	v.SetDefault("health_port", "8090")
	v.SetDefault("temporal_addr", "temporal:7233")
	v.SetDefault("task_queue", "transcode")
	v.SetDefault("transcode_concurrency", 2)

	return WorkerConfig{
		ServiceName:          v.GetString("service_name"),
		HealthPort:           v.GetString("health_port"),
		RedisAddr:            v.GetString("redis_addr"),
		TemporalAddr:         v.GetString("temporal_addr"),
		TaskQueue:            v.GetString("task_queue"),
		S3Endpoint:           v.GetString("s3_endpoint"),
		S3Key:                v.GetString("s3_key"),
		S3Secret:             v.GetString("s3_secret"),
		S3Bucket:             v.GetString("s3_bucket"),
		TranscodeConcurrency: v.GetInt("transcode_concurrency"),
	}
}
