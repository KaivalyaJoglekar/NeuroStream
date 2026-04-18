package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"time"

	"github.com/neurostream/ms1-media-processor/internal/models"
	"github.com/redis/go-redis/v9"
)

// RedisConsumer handles consuming jobs from the Redis queue.
type RedisConsumer struct {
	client    *redis.Client
	queueName string
	dlqName   string
}

// NewRedisConsumer creates a new Redis consumer.
// redisURL should be in the format "redis://host:port" or "redis://host:port/db".
func NewRedisConsumer(redisURL, queueName string) (*RedisConsumer, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Redis URL %q: %w", redisURL, err)
	}

	client := redis.NewClient(opts)

	// Test connectivity with retries
	if err := connectWithRetry(client); err != nil {
		return nil, err
	}

	return &RedisConsumer{
		client:    client,
		queueName: queueName,
		dlqName:   "media_processing_dlq",
	}, nil
}

// ConsumeOne blocks until a job is available on the queue or the timeout expires.
// Returns nil, nil if no job was available within the timeout.
func (rc *RedisConsumer) ConsumeOne(ctx context.Context, timeout time.Duration) (*models.Job, error) {
	result, err := rc.client.BRPop(ctx, timeout, rc.queueName).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, nil // Timeout — no job available
		}
		return nil, fmt.Errorf("BRPOP failed: %w", err)
	}

	// result[0] = queue name, result[1] = job payload
	if len(result) < 2 {
		return nil, fmt.Errorf("unexpected BRPOP result length: %d", len(result))
	}

	var job models.Job
	if err := json.Unmarshal([]byte(result[1]), &job); err != nil {
		return nil, fmt.Errorf("failed to unmarshal job payload: %w", err)
	}

	return &job, nil
}

// PushToDLQ pushes a failed job payload to the dead-letter queue.
func (rc *RedisConsumer) PushToDLQ(ctx context.Context, payload interface{}) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal DLQ payload: %w", err)
	}
	return rc.client.LPush(ctx, rc.dlqName, string(data)).Err()
}

// Close closes the Redis connection.
func (rc *RedisConsumer) Close() error {
	return rc.client.Close()
}

// Client returns the underlying Redis client for health checks.
func (rc *RedisConsumer) Client() *redis.Client {
	return rc.client
}

// connectWithRetry attempts to connect to Redis with exponential backoff and jitter.
func connectWithRetry(client *redis.Client) error {
	maxRetries := 10
	for attempt := 0; attempt < maxRetries; attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		err := client.Ping(ctx).Err()
		cancel()

		if err == nil {
			log.Println("[redis] Connected successfully")
			return nil
		}

		backoff := time.Duration(math.Pow(2, float64(attempt))) * time.Second
		jitter := time.Duration(rand.Intn(1000)) * time.Millisecond
		wait := backoff + jitter
		if wait > 30*time.Second {
			wait = 30*time.Second + jitter
		}

		log.Printf("[redis] Connection attempt %d/%d failed: %v — retrying in %v", attempt+1, maxRetries, err, wait)
		time.Sleep(wait)
	}
	return fmt.Errorf("failed to connect to Redis after %d attempts", maxRetries)
}
