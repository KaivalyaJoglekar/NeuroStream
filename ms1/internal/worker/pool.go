package worker

import (
	"context"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/neurostream/ms1-media-processor/config"
	"github.com/neurostream/ms1-media-processor/internal/callback"
	"github.com/neurostream/ms1-media-processor/internal/queue"
	s3client "github.com/neurostream/ms1-media-processor/internal/s3"
)

// Pool manages a pool of worker goroutines that consume jobs from Redis.
type Pool struct {
	cfg         *config.Config
	consumer    *queue.RedisConsumer
	s3          *s3client.S3Client
	notifier    *callback.MS4Notifier
	workerCount int
	jobsProcessed atomic.Int64
	activeWorkers atomic.Int64
}

// NewPool creates a new worker pool.
func NewPool(cfg *config.Config, consumer *queue.RedisConsumer, s3 *s3client.S3Client, notifier *callback.MS4Notifier) *Pool {
	return &Pool{
		cfg:         cfg,
		consumer:    consumer,
		s3:          s3,
		notifier:    notifier,
		workerCount: cfg.WorkerCount,
	}
}

// Start launches the worker pool goroutines. It blocks until the context is cancelled.
func (p *Pool) Start(ctx context.Context) {
	log.Printf("[pool] Starting %d workers", p.workerCount)

	var wg sync.WaitGroup

	for i := 0; i < p.workerCount; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			p.runWorker(ctx, workerID)
		}(i)
	}

	// Wait for all workers to finish (happens when ctx is cancelled)
	wg.Wait()
	log.Printf("[pool] All workers stopped. Total jobs processed: %d", p.jobsProcessed.Load())
}

// runWorker is the main loop for a single worker goroutine.
func (p *Pool) runWorker(ctx context.Context, workerID int) {
	log.Printf("[worker-%d] Started", workerID)
	p.activeWorkers.Add(1)
	defer p.activeWorkers.Add(-1)

	handler := NewJobHandler(p.cfg, p.s3, p.notifier, p.consumer)

	for {
		select {
		case <-ctx.Done():
			log.Printf("[worker-%d] Context cancelled, shutting down", workerID)
			return
		default:
		}

		// BRPOP with 5-second timeout to allow periodic context checks
		job, err := p.consumer.ConsumeOne(ctx, 5*time.Second)
		if err != nil {
			if ctx.Err() != nil {
				return // Context cancelled during BRPOP
			}
			log.Printf("[worker-%d] Error consuming job: %v", workerID, err)
			time.Sleep(1 * time.Second) // Brief pause before retry
			continue
		}

		if job == nil {
			continue // Timeout — no job available, loop again
		}

		log.Printf("[worker-%d] Processing job %s (video: %s)", workerID, job.JobID, job.VideoID)

		if err := handler.HandleJob(ctx, job); err != nil {
			log.Printf("[worker-%d] Job %s failed: %v", workerID, job.JobID, err)
		} else {
			log.Printf("[worker-%d] Job %s completed successfully", workerID, job.JobID)
		}

		p.jobsProcessed.Add(1)
	}
}

// JobsProcessed returns the total number of jobs processed.
func (p *Pool) JobsProcessed() int64 {
	return p.jobsProcessed.Load()
}

// ActiveWorkers returns the number of currently active workers.
func (p *Pool) ActiveWorkers() int64 {
	return p.activeWorkers.Load()
}
