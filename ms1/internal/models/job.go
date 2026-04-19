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

// MS4CallbackPayload strictly matches MS4's StatusCallbackRequest schema.
type MS4CallbackPayload struct {
	VideoID          string                 `json:"videoId"`
	ServiceName      string                 `json:"serviceName"`
	NewStatus        string                 `json:"newStatus"`
	Message          string                 `json:"message"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
	ProcessedMinutes float64                `json:"processedMinutes,omitempty"`
}

// NewSuccessCallback creates a success callback payload matching MS4 standards.
func NewSuccessCallback(job *Job, artifacts ArtifactsManifest) MS4CallbackPayload {
	return MS4CallbackPayload{
		VideoID:     job.VideoID,
		ServiceName: "media-processor",
		NewStatus:   "MEDIA_PROCESSED",
		Message:     "Media processing completed successfully",
		Metadata: map[string]interface{}{
			"job_id":       job.JobID,
			"processed_at": time.Now().UTC().Format(time.RFC3339),
			"artifacts":    artifacts,
		},
		ProcessedMinutes: artifacts.TotalDurationSeconds / 60.0,
	}
}

// NewFailureCallback creates a failure callback payload.
func NewFailureCallback(job *Job, stage, message string, retryCount int) MS4CallbackPayload {
	return MS4CallbackPayload{
		VideoID:     job.VideoID,
		ServiceName: "media-processor",
		NewStatus:   "FAILED",
		Message:     message,
		Metadata: map[string]interface{}{
			"job_id":      job.JobID,
			"failed_at":   time.Now().UTC().Format(time.RFC3339),
			"stage":       stage,
			"retry_count": retryCount,
		},
	}
}

