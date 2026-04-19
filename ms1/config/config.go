package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// Config holds all environment-based configuration for MS1.
type Config struct {
	// Redis
	RedisURL       string
	RedisQueueName string

	// AWS S3
	AWSRegion          string
	AWSAccessKeyID     string
	AWSSecretAccessKey string
	S3BucketName       string
	S3Endpoint         string // For MinIO/LocalStack compatibility
	S3RawPrefix        string
	S3ProcessedPrefix  string

	// FFmpeg Settings
	ChunkDurationSeconds int
	FrameSampleFPS       int
	AudioFormat          string

	// Worker Pool
	WorkerCount int

	// MS4 Callback
	MS4CallbackURL string
	InternalAPIKey string

	// Temp Storage
	// Temp Storage
	TempDir string

	// Server
	ServerPort string
}

// Load reads environment variables and returns a validated Config.
func Load() (*Config, error) {
	// Load .env file if it exists (non-fatal if missing)
	_ = godotenv.Load()

	cfg := &Config{
		RedisURL:           getEnv("REDIS_URL", "redis://localhost:6379"),
		RedisQueueName:     getEnv("REDIS_QUEUE_NAME", "media_processing_jobs"),
		AWSRegion:          getEnvAny([]string{"AWS_REGION", "S3_REGION"}, "ap-south-1"),
		AWSAccessKeyID:     getEnvAny([]string{"AWS_ACCESS_KEY_ID", "S3_ACCESS_KEY_ID"}, ""),
		AWSSecretAccessKey: getEnvAny([]string{"AWS_SECRET_ACCESS_KEY", "S3_SECRET_ACCESS_KEY"}, ""),
		S3BucketName:       getEnvAny([]string{"S3_BUCKET_NAME", "AWS_S3_BUCKET"}, "neurostream-media"),
		S3Endpoint:         getEnvAny([]string{"S3_ENDPOINT", "AWS_ENDPOINT_URL"}, ""),
		S3RawPrefix:        getEnv("S3_RAW_PREFIX", "raw-uploads"),
		S3ProcessedPrefix:  getEnv("S3_PROCESSED_PREFIX", "processed"),
		AudioFormat:        getEnv("AUDIO_FORMAT", "wav"),
		MS4CallbackURL:     getEnv("MS4_CALLBACK_URL", "http://ms4-service:4000/internal/job-status"),
		InternalAPIKey:     getEnv("INTERNAL_API_KEY", "development-internal-key-123"),
		TempDir:            getEnv("TEMP_DIR", "/tmp/neurostream"),
		ServerPort:         getEnv("SERVER_PORT", "8081"),
	}

	var err error

	cfg.ChunkDurationSeconds, err = getEnvInt("CHUNK_DURATION_SECONDS", 30)
	if err != nil {
		return nil, fmt.Errorf("invalid CHUNK_DURATION_SECONDS: %w", err)
	}

	cfg.FrameSampleFPS, err = getEnvInt("FRAME_SAMPLE_FPS", 1)
	if err != nil {
		return nil, fmt.Errorf("invalid FRAME_SAMPLE_FPS: %w", err)
	}

	cfg.WorkerCount, err = getEnvInt("WORKER_COUNT", 5)
	if err != nil {
		return nil, fmt.Errorf("invalid WORKER_COUNT: %w", err)
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

func (c *Config) validate() error {
	if c.S3BucketName == "" {
		return fmt.Errorf("S3 bucket is required (set S3_BUCKET_NAME or AWS_S3_BUCKET)")
	}
	if c.WorkerCount < 1 {
		return fmt.Errorf("WORKER_COUNT must be >= 1")
	}
	if c.ChunkDurationSeconds < 1 {
		return fmt.Errorf("CHUNK_DURATION_SECONDS must be >= 1")
	}
	return nil
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
	}
	return fallback
}

func getEnvAny(keys []string, fallback string) string {
	for _, key := range keys {
		if val, ok := os.LookupEnv(key); ok {
			return val
		}
	}
	return fallback
}

func getEnvInt(key string, fallback int) (int, error) {
	val, ok := os.LookupEnv(key)
	if !ok {
		return fallback, nil
	}
	parsed, err := strconv.Atoi(val)
	if err != nil {
		return 0, fmt.Errorf("cannot parse %s=%q as int: %w", key, val, err)
	}
	return parsed, nil
}
