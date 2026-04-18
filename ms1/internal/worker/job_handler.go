package worker

import (
	"context"
	"fmt"
	"log"
	"math"
	"os"
	"path/filepath"
	"sync"

	"github.com/neurostream/ms1-media-processor/config"
	"github.com/neurostream/ms1-media-processor/internal/callback"
	"github.com/neurostream/ms1-media-processor/internal/ffmpeg"
	"github.com/neurostream/ms1-media-processor/internal/models"
	"github.com/neurostream/ms1-media-processor/internal/queue"
	s3client "github.com/neurostream/ms1-media-processor/internal/s3"
)

const (
	maxFFmpegRetries  = 2
	maxS3DownRetries  = 3
	maxS3UpRetries    = 3
)

// JobHandler orchestrates the processing of a single media job.
type JobHandler struct {
	cfg      *config.Config
	s3       *s3client.S3Client
	notifier *callback.MS4Notifier
	consumer *queue.RedisConsumer
}

// NewJobHandler creates a new job handler.
func NewJobHandler(cfg *config.Config, s3 *s3client.S3Client, notifier *callback.MS4Notifier, consumer *queue.RedisConsumer) *JobHandler {
	return &JobHandler{
		cfg:      cfg,
		s3:       s3,
		notifier: notifier,
		consumer: consumer,
	}
}

// HandleJob processes a single video processing job end-to-end.
func (jh *JobHandler) HandleJob(ctx context.Context, job *models.Job) error {
	jobDir := filepath.Join(jh.cfg.TempDir, job.JobID)
	// Always clean up temp files regardless of outcome
	defer jh.cleanup(jobDir)

	log.Printf("[job:%s] Starting processing for video %s", job.JobID, job.VideoID)

	// 1. Download raw video from S3
	localVideoPath := filepath.Join(jobDir, "original.mp4")
	if err := jh.s3.DownloadFile(ctx, job.S3RawPath, localVideoPath, maxS3DownRetries); err != nil {
		jh.notifyFailure(ctx, job, "S3_DOWNLOAD", err.Error(), maxS3DownRetries)
		return fmt.Errorf("download failed: %w", err)
	}
	log.Printf("[job:%s] Downloaded video to %s", job.JobID, localVideoPath)

	// 2. Get video duration
	totalDuration, err := ffmpeg.GetVideoDuration(localVideoPath)
	if err != nil {
		log.Printf("[job:%s] Warning: couldn't get video duration: %v (using file_size estimate)", job.JobID, err)
		totalDuration = 0
	}

	// 3. Chunk video
	chunksDir := filepath.Join(jobDir, "chunks")
	chunks, err := jh.chunkWithRetry(localVideoPath, chunksDir)
	if err != nil {
		jh.notifyFailure(ctx, job, "VIDEO_CHUNKING", err.Error(), maxFFmpegRetries)
		return fmt.Errorf("chunking failed: %w", err)
	}
	log.Printf("[job:%s] Created %d chunks", job.JobID, len(chunks))

	// 4. Process each chunk in parallel (audio + frames)
	audioDir := filepath.Join(jobDir, "audio")
	framesDir := filepath.Join(jobDir, "frames")

	results := make([]chunkProcessResult, len(chunks))
	var wg sync.WaitGroup

	for i, chunk := range chunks {
		wg.Add(1)
		go func(idx int, c ffmpeg.ChunkResult) {
			defer wg.Done()
			result := chunkProcessResult{chunkIndex: c.Index}

			// Extract audio
			audioPath, err := jh.extractAudioWithRetry(c.FilePath, audioDir, c.Index)
			if err != nil {
				result.err = fmt.Errorf("audio extraction chunk %d: %w", c.Index, err)
				results[idx] = result
				return
			}
			result.audioPath = audioPath

			// Sample frames
			framePaths, err := jh.sampleFramesWithRetry(c.FilePath, framesDir, c.Index)
			if err != nil {
				result.err = fmt.Errorf("frame sampling chunk %d: %w", c.Index, err)
				results[idx] = result
				return
			}
			result.framePaths = framePaths
			results[idx] = result
		}(i, chunk)
	}
	wg.Wait()

	// Check for any processing failures
	for _, r := range results {
		if r.err != nil {
			jh.notifyFailure(ctx, job, "CHUNK_PROCESSING", r.err.Error(), maxFFmpegRetries)
			return fmt.Errorf("chunk processing failed: %w", r.err)
		}
	}
	log.Printf("[job:%s] All chunks processed (audio + frames)", job.JobID)

	// 5. Upload all artifacts to S3
	s3BasePath := fmt.Sprintf("%s/%s", jh.cfg.S3ProcessedPrefix, job.VideoID)

	if err := jh.uploadArtifacts(ctx, job, jobDir, s3BasePath); err != nil {
		jh.notifyFailure(ctx, job, "S3_UPLOAD", err.Error(), maxS3UpRetries)
		return fmt.Errorf("upload failed: %w", err)
	}
	log.Printf("[job:%s] All artifacts uploaded to S3", job.JobID)

	// 6. Build artifact manifest
	manifest := jh.buildManifest(job, chunks, results, s3BasePath, totalDuration)

	// 7. Notify MS4 of success
	successPayload := models.NewSuccessCallback(job, manifest)
	if err := jh.notifier.Notify(ctx, successPayload); err != nil {
		log.Printf("[job:%s] Failed to notify MS4 — pushing to DLQ: %v", job.JobID, err)
		if dlqErr := jh.consumer.PushToDLQ(ctx, successPayload); dlqErr != nil {
			log.Printf("[job:%s] DLQ push also failed: %v", job.JobID, dlqErr)
		}
		return fmt.Errorf("callback failed: %w", err)
	}

	log.Printf("[job:%s] Job completed successfully", job.JobID)
	return nil
}

// chunkWithRetry retries the chunking operation.
func (jh *JobHandler) chunkWithRetry(inputPath, outputDir string) ([]ffmpeg.ChunkResult, error) {
	var lastErr error
	for attempt := 0; attempt <= maxFFmpegRetries; attempt++ {
		chunks, err := ffmpeg.ChunkVideo(inputPath, outputDir, jh.cfg.ChunkDurationSeconds)
		if err == nil {
			return chunks, nil
		}
		lastErr = err
		log.Printf("[ffmpeg] Chunk retry %d/%d: %v", attempt+1, maxFFmpegRetries+1, err)
	}
	return nil, lastErr
}

// extractAudioWithRetry retries audio extraction.
func (jh *JobHandler) extractAudioWithRetry(chunkPath, outputDir string, chunkIndex int) (string, error) {
	var lastErr error
	for attempt := 0; attempt <= maxFFmpegRetries; attempt++ {
		path, err := ffmpeg.ExtractAudio(chunkPath, outputDir, chunkIndex, jh.cfg.AudioFormat)
		if err == nil {
			return path, nil
		}
		lastErr = err
		log.Printf("[ffmpeg] Audio extract retry %d/%d chunk %d: %v", attempt+1, maxFFmpegRetries+1, chunkIndex, err)
	}
	return "", lastErr
}

// sampleFramesWithRetry retries frame sampling.
func (jh *JobHandler) sampleFramesWithRetry(chunkPath, outputDir string, chunkIndex int) ([]string, error) {
	var lastErr error
	for attempt := 0; attempt <= maxFFmpegRetries; attempt++ {
		paths, err := ffmpeg.SampleFrames(chunkPath, outputDir, chunkIndex, jh.cfg.FrameSampleFPS)
		if err == nil {
			return paths, nil
		}
		lastErr = err
		log.Printf("[ffmpeg] Frame sample retry %d/%d chunk %d: %v", attempt+1, maxFFmpegRetries+1, chunkIndex, err)
	}
	return nil, lastErr
}

// uploadArtifacts uploads chunks, audio, and frames to S3.
func (jh *JobHandler) uploadArtifacts(ctx context.Context, job *models.Job, jobDir, s3BasePath string) error {
	// Upload chunks
	chunksDir := filepath.Join(jobDir, "chunks")
	if _, err := jh.s3.UploadDirectory(ctx, chunksDir, s3BasePath+"/chunks", maxS3UpRetries); err != nil {
		return fmt.Errorf("chunk upload failed: %w", err)
	}

	// Upload audio
	audioDir := filepath.Join(jobDir, "audio")
	if _, err := jh.s3.UploadDirectory(ctx, audioDir, s3BasePath+"/audio", maxS3UpRetries); err != nil {
		return fmt.Errorf("audio upload failed: %w", err)
	}

	// Upload frames
	framesDir := filepath.Join(jobDir, "frames")
	if _, err := jh.s3.UploadDirectory(ctx, framesDir, s3BasePath+"/frames", maxS3UpRetries); err != nil {
		return fmt.Errorf("frames upload failed: %w", err)
	}

	return nil
}

// buildManifest constructs the artifacts manifest for the MS4 callback.
func (jh *JobHandler) buildManifest(job *models.Job, chunks []ffmpeg.ChunkResult, results []chunkProcessResult, s3BasePath string, totalDuration float64) models.ArtifactsManifest {
	chunkDuration := float64(jh.cfg.ChunkDurationSeconds)
	var chunkArtifacts []models.ChunkArtifact

	for i, chunk := range chunks {
		startTime := float64(chunk.Index) * chunkDuration
		endTime := float64(chunk.Index+1) * chunkDuration

		// Cap the last chunk at actual video duration
		if totalDuration > 0 && endTime > totalDuration {
			endTime = totalDuration
		}

		duration := endTime - startTime

		// Build frame S3 keys
		var frameS3Keys []string
		for _, framePath := range results[i].framePaths {
			// Extract relative path from frames dir: chunk_XXX/frame_XXXX.jpg
			relPath := filepath.Base(filepath.Dir(framePath)) + "/" + filepath.Base(framePath)
			frameS3Keys = append(frameS3Keys, fmt.Sprintf("%s/frames/%s", s3BasePath, relPath))
		}

		chunkArtifacts = append(chunkArtifacts, models.ChunkArtifact{
			ChunkIndex:       chunk.Index,
			ChunkS3Key:       fmt.Sprintf("%s/chunks/chunk_%03d.mp4", s3BasePath, chunk.Index),
			AudioS3Key:       fmt.Sprintf("%s/audio/chunk_%03d_audio.%s", s3BasePath, chunk.Index, jh.cfg.AudioFormat),
			FrameS3Keys:      frameS3Keys,
			StartTimeSeconds: startTime,
			EndTimeSeconds:   endTime,
			DurationSeconds:  math.Round(duration*100) / 100,
		})
	}

	if totalDuration == 0 && len(chunks) > 0 {
		totalDuration = float64(len(chunks)) * chunkDuration
	}

	return models.ArtifactsManifest{
		S3ProcessedBasePath:  s3BasePath,
		ChunkCount:           len(chunks),
		Chunks:               chunkArtifacts,
		TotalDurationSeconds: totalDuration,
	}
}

// notifyFailure sends a failure callback to MS4 and falls back to DLQ.
func (jh *JobHandler) notifyFailure(ctx context.Context, job *models.Job, stage, message string, retryCount int) {
	failPayload := models.NewFailureCallback(job, stage, message, retryCount)
	if err := jh.notifier.Notify(ctx, failPayload); err != nil {
		log.Printf("[job:%s] Failed to send failure callback — pushing to DLQ: %v", job.JobID, err)
		if dlqErr := jh.consumer.PushToDLQ(ctx, failPayload); dlqErr != nil {
			log.Printf("[job:%s] DLQ push also failed: %v", job.JobID, dlqErr)
		}
	}
}

// cleanup removes the temporary job directory.
func (jh *JobHandler) cleanup(jobDir string) {
	if err := os.RemoveAll(jobDir); err != nil {
		log.Printf("[cleanup] Failed to remove %s: %v", jobDir, err)
	} else {
		log.Printf("[cleanup] Removed temp dir %s", jobDir)
	}
}

// chunkProcessResult is defined here to avoid circular import (used in buildManifest).
type chunkProcessResult struct {
	chunkIndex int
	audioPath  string
	framePaths []string
	err        error
}
