package models

import "time"

// Job represents an incoming video processing job from the Redis queue.
type Job struct {
	JobID            string `json:"job_id"`
	VideoID          string `json:"video_id"`
	UserID           string `json:"user_id"`
	S3RawPath        string `json:"s3_raw_path"`
	OriginalFilename string `json:"original_filename"`
	ContentType      string `json:"content_type"`
	FileSizeBytes    int64  `json:"file_size_bytes"`
	EnqueuedAt       string `json:"enqueued_at"`
}

// ChunkArtifact represents a single processed chunk with all its associated artifacts.
type ChunkArtifact struct {
	ChunkIndex       int      `json:"chunk_index"`
	ChunkS3Key       string   `json:"chunk_s3_key"`
	AudioS3Key       string   `json:"audio_s3_key"`
	FrameS3Keys      []string `json:"frame_s3_keys"`
	StartTimeSeconds float64  `json:"start_time_seconds"`
	EndTimeSeconds   float64  `json:"end_time_seconds"`
	DurationSeconds  float64  `json:"duration_seconds"`
}

// ArtifactsManifest holds the complete output manifest for a processed video.
type ArtifactsManifest struct {
	S3ProcessedBasePath  string          `json:"s3_processed_base_path"`
	ChunkCount           int             `json:"chunk_count"`
	Chunks               []ChunkArtifact `json:"chunks"`
	TotalDurationSeconds float64         `json:"total_duration_seconds"`
}

// SuccessCallback is the payload sent to MS4 on successful processing.
type SuccessCallback struct {
	JobID       string            `json:"job_id"`
	VideoID     string            `json:"video_id"`
	Status      string            `json:"status"`
	ProcessedAt string            `json:"processed_at"`
	Artifacts   ArtifactsManifest `json:"artifacts"`
}

// ErrorDetail holds error information for failed jobs.
type ErrorDetail struct {
	Stage      string `json:"stage"`
	Message    string `json:"message"`
	RetryCount int    `json:"retry_count"`
}

// FailureCallback is the payload sent to MS4 on processing failure.
type FailureCallback struct {
	JobID    string      `json:"job_id"`
	VideoID  string      `json:"video_id"`
	Status   string      `json:"status"`
	FailedAt string      `json:"failed_at"`
	Error    ErrorDetail `json:"error"`
}

// NewSuccessCallback creates a success callback payload.
func NewSuccessCallback(job *Job, artifacts ArtifactsManifest) SuccessCallback {
	return SuccessCallback{
		JobID:       job.JobID,
		VideoID:     job.VideoID,
		Status:      "MEDIA_PROCESSING_COMPLETE",
		ProcessedAt: time.Now().UTC().Format(time.RFC3339),
		Artifacts:   artifacts,
	}
}

// NewFailureCallback creates a failure callback payload.
func NewFailureCallback(job *Job, stage, message string, retryCount int) FailureCallback {
	return FailureCallback{
		JobID:   job.JobID,
		VideoID: job.VideoID,
		Status:  "MEDIA_PROCESSING_FAILED",
		FailedAt: time.Now().UTC().Format(time.RFC3339),
		Error: ErrorDetail{
			Stage:      stage,
			Message:    message,
			RetryCount: retryCount,
		},
	}
}
