package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/neurostream/ms1-media-processor/config"
	"github.com/neurostream/ms1-media-processor/internal/callback"
	"github.com/neurostream/ms1-media-processor/internal/queue"
	s3client "github.com/neurostream/ms1-media-processor/internal/s3"
	"github.com/neurostream/ms1-media-processor/internal/worker"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("[ms1] Starting NeuroStream Media Processor...")

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("[ms1] Failed to load config: %v", err)
	}
	log.Printf("[ms1] Config loaded (workers=%d, chunk_duration=%ds, fps=%d)", cfg.WorkerCount, cfg.ChunkDurationSeconds, cfg.FrameSampleFPS)

	// Ensure temp directory exists
	if err := os.MkdirAll(cfg.TempDir, 0755); err != nil {
		log.Fatalf("[ms1] Failed to create temp dir %s: %v", cfg.TempDir, err)
	}

	// Initialize Redis consumer
	consumer, err := queue.NewRedisConsumer(cfg.RedisURL, cfg.RedisQueueName)
	if err != nil {
		log.Fatalf("[ms1] Failed to initialize Redis consumer: %v", err)
	}
	defer consumer.Close()

	// Initialize S3 client
	s3, err := s3client.NewS3Client(
		cfg.AWSRegion,
		cfg.AWSAccessKeyID,
		cfg.AWSSecretAccessKey,
		cfg.S3BucketName,
		cfg.S3Endpoint,
	)
	if err != nil {
		log.Fatalf("[ms1] Failed to initialize S3 client: %v", err)
	}

	// Initialize MS4 notifier
	notifier := callback.NewMS4Notifier(cfg.MS4CallbackURL, cfg.InternalAPIKey)

	// Create worker pool
	pool := worker.NewPool(cfg, consumer, s3, notifier)

	// Create a cancellable context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle shutdown signals
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	// Start health check HTTP server
	go startHealthServer(cfg.ServerPort, pool)

	// Start worker pool in a separate goroutine
	go func() {
		pool.Start(ctx)
	}()

	log.Printf("[ms1] Service ready — health endpoint at :%s/health", cfg.ServerPort)

	// Wait for shutdown signal
	sig := <-sigCh
	log.Printf("[ms1] Received signal %v — initiating graceful shutdown...", sig)
	cancel()

	log.Println("[ms1] Shutdown complete")
}

// startHealthServer runs a minimal HTTP server for health checks.
func startHealthServer(port string, pool *worker.Pool) {
	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		resp := map[string]interface{}{
			"status":         "ok",
			"workers_active": pool.ActiveWorkers(),
			"jobs_processed": pool.JobsProcessed(),
		}
		json.NewEncoder(w).Encode(resp)
	})

	addr := fmt.Sprintf(":%s", port)
	log.Printf("[health] HTTP server listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Printf("[health] HTTP server error: %v", err)
	}
}
