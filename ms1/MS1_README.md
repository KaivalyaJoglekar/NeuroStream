# MS1 — NeuroStream Media Processor

> **NeuroStream Microservice 1 | Language: Go | Role: High-Concurrency Video Chunking & Frame Extraction**

---

## Table of Contents

1. [Overview](#overview)
2. [Responsibilities](#responsibilities)
3. [Architecture & Position in Pipeline](#architecture--position-in-pipeline)
4. [Tech Stack](#tech-stack)
5. [Directory Structure](#directory-structure)
6. [Environment Variables](#environment-variables)
7. [API Endpoints](#api-endpoints)
8. [Redis Job Schema](#redis-job-schema)
9. [FFmpeg Operations](#ffmpeg-operations)
10. [S3 Interaction Pattern](#s3-interaction-pattern)
11. [Status Callback Contract](#status-callback-contract)
12. [Data Flow (Step-by-Step)](#data-flow-step-by-step)
13. [Error Handling & Retry Logic](#error-handling--retry-logic)
14. [Local Development](#local-development)
15. [Docker](#docker)
16. [Key Implementation Notes for Claude](#key-implementation-notes-for-claude)

---

## Overview

MS1 is the **entry point of the AI processing pipeline**. It is a Go service that wraps FFmpeg to transform raw, user-uploaded video files into normalized, AI-ready media artifacts. It consumes processing jobs from a **Redis queue**, downloads the raw video from **AWS S3**, performs chunking, audio extraction, and frame sampling, then uploads the processed artifacts back to S3 and notifies MS4 of completion.

MS1 is designed for **high-concurrency** — multiple videos must be processed in parallel using Go routines and worker pools.

---

## Responsibilities

| # | Responsibility | Description |
|---|---|---|
| 1 | **Job Consumption** | Poll the Redis queue (`media_processing_jobs`) for incoming video processing tasks dispatched by MS4. |
| 2 | **Video Download** | Securely download the raw video file from the S3 path provided in the job payload. |
| 3 | **Video Chunking** | Split the video into fixed-duration segments (e.g., 30-second chunks) for parallel downstream AI processing. |
| 4 | **Audio Extraction** | Extract the audio track from each chunk as a `.wav` or `.mp3` file for MS2's Whisper transcription. |
| 5 | **Frame Sampling** | Sample keyframes from each chunk at a defined FPS (e.g., 1 frame/sec) as `.jpg` images for MS2's vision analysis. |
| 6 | **Transcoding** | Normalize video codec/resolution if needed (e.g., to H.264/720p) for consistent downstream processing. |
| 7 | **S3 Upload** | Upload all processed artifacts (chunks, audio files, frames) to a structured path in S3. |
| 8 | **Status Callback** | POST a completion (or failure) status update back to MS4's internal callback endpoint. |

---

## Architecture & Position in Pipeline

```
[User Frontend]
      |
      v
[AWS API Gateway]
      |
      v
[MS4 - Node.js: User Workflow] ──────────────────────────────────┐
      |                                                            |
      | pushes job to Redis                                       | receives status callbacks
      v                                                            |
[Redis Queue: media_processing_jobs]                              |
      |                                                            |
      v                                                            |
[MS1 - Go: Media Processor] <─────────────────────────────────────┘
      |
      | downloads raw video
      v
[AWS S3: raw-uploads/]
      |
      | uploads processed artifacts
      v
[AWS S3: processed/{video_id}/chunks/, audio/, frames/]
      |
      | notifies with S3 paths
      v
[MS2 - Python FastAPI: AI Vision & NLP]
```

---

## Tech Stack

| Component | Technology | Purpose |
|---|---|---|
| Language | Go (1.22+) | High-concurrency worker service |
| Media Processing | FFmpeg (via `os/exec`) | Chunking, audio extraction, frame sampling |
| Job Queue Consumer | Redis (`go-redis/v9`) | Consuming `BRPOP`-based job queue |
| Object Storage | AWS S3 (`aws-sdk-go-v2`) | Download inputs, upload outputs |
| HTTP Client | Go `net/http` | Callback POSTs to MS4 |
| Config | `godotenv` / ENV vars | Environment-based configuration |
| Containerization | Docker + FFmpeg base image | Deployment |

---

## Directory Structure

```
ms1-media-processor/
├── cmd/
│   └── main.go                  # Entry point — starts worker pool
├── internal/
│   ├── worker/
│   │   ├── pool.go              # Worker pool — launches N goroutines
│   │   └── job_handler.go       # Core job processing logic
│   ├── ffmpeg/
│   │   ├── chunker.go           # Splits video into time-based segments
│   │   ├── audio_extractor.go   # Extracts audio from each chunk
│   │   └── frame_sampler.go     # Samples frames at defined FPS
│   ├── s3/
│   │   ├── downloader.go        # Downloads raw video from S3
│   │   └── uploader.go          # Uploads processed artifacts to S3
│   ├── queue/
│   │   └── redis_consumer.go    # Connects to Redis, BRPOP job loop
│   ├── callback/
│   │   └── ms4_notifier.go      # POSTs status updates back to MS4
│   └── models/
│       └── job.go               # Job and artifact struct definitions
├── config/
│   └── config.go                # Loads and validates env vars
├── Dockerfile
├── docker-compose.yml
├── go.mod
├── go.sum
└── README.md
```

---

## Environment Variables

Create a `.env` file in the root:

```env
# Redis
REDIS_URL=redis://localhost:6379
REDIS_QUEUE_NAME=media_processing_jobs

# AWS S3
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=neurostream-media

# S3 Path Prefixes (convention)
S3_RAW_PREFIX=raw-uploads
S3_PROCESSED_PREFIX=processed

# FFmpeg Settings
CHUNK_DURATION_SECONDS=30
FRAME_SAMPLE_FPS=1
AUDIO_FORMAT=wav

# Worker Pool
WORKER_COUNT=5

# MS4 Callback
MS4_CALLBACK_URL=http://ms4-service:3000/internal/callbacks/media-complete

# Temp Storage (local disk for processing)
TEMP_DIR=/tmp/neurostream
```

---

## API Endpoints

MS1 is primarily a **queue-driven worker**, not an HTTP server. However, it exposes a minimal HTTP server for health checks and operational control.

### `GET /health`

**Purpose:** Liveness probe for container orchestration.

**Response:**
```json
{
  "status": "ok",
  "workers_active": 5,
  "jobs_processed": 142
}
```

---

### `GET /metrics` *(optional)*

**Purpose:** Exposes Prometheus-compatible metrics.

**Metrics exposed:**
- `ms1_jobs_consumed_total`
- `ms1_jobs_succeeded_total`
- `ms1_jobs_failed_total`
- `ms1_processing_duration_seconds`

---

## Redis Job Schema

MS4 pushes jobs to the Redis list `media_processing_jobs` using `LPUSH`. MS1 consumes using `BRPOP` (blocking pop).

### Job Payload (JSON string in Redis)

```json
{
  "job_id": "job_a1b2c3d4",
  "video_id": "vid_xyz789",
  "user_id": "usr_abc123",
  "s3_raw_path": "raw-uploads/usr_abc123/vid_xyz789/original.mp4",
  "original_filename": "lecture_week3.mp4",
  "content_type": "video/mp4",
  "file_size_bytes": 524288000,
  "enqueued_at": "2025-04-12T10:30:00Z"
}
```

### Field Descriptions

| Field | Type | Description |
|---|---|---|
| `job_id` | string | Unique ID for this processing job |
| `video_id` | string | Stable video identifier (matches PostgreSQL record in MS4) |
| `user_id` | string | Owner of the video |
| `s3_raw_path` | string | Full S3 key to the original uploaded video |
| `original_filename` | string | Original filename for logging/reference |
| `content_type` | string | MIME type of the uploaded file |
| `file_size_bytes` | int | Used for timeout and resource estimation |
| `enqueued_at` | ISO8601 string | Timestamp of when MS4 pushed the job |

---

## FFmpeg Operations

All FFmpeg commands are executed via Go's `os/exec` package. The `ffmpeg` binary must be available in the container's `PATH`.

### 1. Video Chunking

Splits the source video into segments of `CHUNK_DURATION_SECONDS` seconds.

```bash
ffmpeg -i input.mp4 \
  -c copy \
  -map 0 \
  -segment_time 30 \
  -f segment \
  -reset_timestamps 1 \
  output_chunk_%03d.mp4
```

**Output:** `chunk_000.mp4`, `chunk_001.mp4`, `chunk_002.mp4`, ...

---

### 2. Audio Extraction (per chunk)

Extracts the audio track from each chunk as a WAV file for Whisper.

```bash
ffmpeg -i chunk_000.mp4 \
  -vn \
  -acodec pcm_s16le \
  -ar 16000 \
  -ac 1 \
  chunk_000_audio.wav
```

**Note:** 16kHz mono WAV is the optimal input format for Whisper.

---

### 3. Frame Sampling (per chunk)

Extracts one frame per second from each chunk.

```bash
ffmpeg -i chunk_000.mp4 \
  -vf fps=1 \
  -q:v 2 \
  chunk_000_frame_%04d.jpg
```

**Output:** `chunk_000_frame_0001.jpg`, `chunk_000_frame_0002.jpg`, ...

---

### 4. Transcoding (if needed)

Normalize codec for compatibility if the source is not H.264:

```bash
ffmpeg -i input.mkv \
  -vcodec libx264 \
  -acodec aac \
  -vf scale=-2:720 \
  output_normalized.mp4
```

**This step should be skipped if the source is already H.264/AAC to save processing time.**

---

## S3 Interaction Pattern

### Download (Input)

```
s3://neurostream-media/raw-uploads/{user_id}/{video_id}/original.mp4
  → downloaded to → /tmp/neurostream/{job_id}/original.mp4
```

### Upload (Output)

After processing, all artifacts are uploaded to:

```
s3://neurostream-media/processed/{video_id}/
  ├── chunks/
  │   ├── chunk_000.mp4
  │   ├── chunk_001.mp4
  │   └── chunk_002.mp4
  ├── audio/
  │   ├── chunk_000_audio.wav
  │   ├── chunk_001_audio.wav
  │   └── chunk_002_audio.wav
  └── frames/
      ├── chunk_000/
      │   ├── frame_0001.jpg
      │   └── frame_0002.jpg
      └── chunk_001/
          ├── frame_0001.jpg
          └── frame_0002.jpg
```

**Cleanup:** Local `/tmp/neurostream/{job_id}/` directory must be deleted after successful upload.

---

## Status Callback Contract

After processing (success or failure), MS1 POSTs to MS4's callback URL:

**Endpoint:** `POST {MS4_CALLBACK_URL}`

**Headers:**
```
Content-Type: application/json
X-Service-Name: ms1-media-processor
```

### Success Payload

```json
{
  "job_id": "job_a1b2c3d4",
  "video_id": "vid_xyz789",
  "status": "MEDIA_PROCESSING_COMPLETE",
  "processed_at": "2025-04-12T10:35:42Z",
  "artifacts": {
    "s3_processed_base_path": "processed/vid_xyz789",
    "chunk_count": 3,
    "chunks": [
      {
        "chunk_index": 0,
        "chunk_s3_key": "processed/vid_xyz789/chunks/chunk_000.mp4",
        "audio_s3_key": "processed/vid_xyz789/audio/chunk_000_audio.wav",
        "frame_s3_keys": [
          "processed/vid_xyz789/frames/chunk_000/frame_0001.jpg",
          "processed/vid_xyz789/frames/chunk_000/frame_0002.jpg"
        ],
        "start_time_seconds": 0,
        "end_time_seconds": 30,
        "duration_seconds": 30
      }
    ],
    "total_duration_seconds": 87
  }
}
```

### Failure Payload

```json
{
  "job_id": "job_a1b2c3d4",
  "video_id": "vid_xyz789",
  "status": "MEDIA_PROCESSING_FAILED",
  "failed_at": "2025-04-12T10:33:11Z",
  "error": {
    "stage": "AUDIO_EXTRACTION",
    "message": "ffmpeg exited with code 1: No audio stream found",
    "retry_count": 3
  }
}
```

---

## Data Flow (Step-by-Step)

```
1. BRPOP from Redis queue `media_processing_jobs`
        ↓
2. Unmarshal job JSON payload
        ↓
3. Download raw video from S3 to local /tmp/neurostream/{job_id}/
        ↓
4. [Optional] Transcode to H.264/AAC if source codec is not compatible
        ↓
5. Chunk video into N × {CHUNK_DURATION_SECONDS}-second segments
        ↓
6. For each chunk (in parallel goroutines):
     a. Extract audio → .wav
     b. Sample frames → .jpg files
        ↓
7. Upload all artifacts to S3 under processed/{video_id}/
        ↓
8. Build artifacts manifest (S3 keys, timestamps, counts)
        ↓
9. POST success callback to MS4 with full artifact manifest
        ↓
10. Delete local /tmp/neurostream/{job_id}/ directory
        ↓
11. Go back to step 1 (BRPOP again)
```

---

## Error Handling & Retry Logic

| Failure Point | Strategy |
|---|---|
| Redis connection failure | Exponential backoff with jitter, retry indefinitely |
| S3 download failure | Retry up to 3 times with backoff; callback MS4 with `FAILED` on exhaustion |
| FFmpeg non-zero exit | Log stderr; retry the specific FFmpeg command up to 2 times; mark job as failed |
| S3 upload failure | Retry up to 3 times; on exhaustion, attempt to clean up partial uploads and callback MS4 with `FAILED` |
| MS4 callback failure | Retry up to 5 times with exponential backoff (the callback is critical — MS4 drives all state transitions) |

**Dead Letter Queue:** Jobs that fail after all retries should be pushed to a `media_processing_dlq` Redis list for manual inspection.

---

## Local Development

### Prerequisites

- Go 1.22+
- FFmpeg installed (`brew install ffmpeg` / `apt install ffmpeg`)
- Docker (for Redis and MinIO/LocalStack)
- AWS CLI or LocalStack for local S3 simulation

### Setup

```bash
# 1. Clone and enter directory
cd ms1-media-processor

# 2. Copy env file
cp .env.example .env
# Edit .env to point to local Redis and MinIO

# 3. Start dependencies
docker-compose up -d redis minio

# 4. Install Go dependencies
go mod download

# 5. Run the service
go run ./cmd/main.go
```

### Testing a Job Manually

Push a test job directly to Redis:

```bash
redis-cli LPUSH media_processing_jobs '{
  "job_id": "test_job_001",
  "video_id": "vid_test_001",
  "user_id": "usr_test",
  "s3_raw_path": "raw-uploads/usr_test/vid_test_001/sample.mp4",
  "original_filename": "sample.mp4",
  "content_type": "video/mp4",
  "file_size_bytes": 10485760,
  "enqueued_at": "2025-04-12T10:00:00Z"
}'
```

---

## Docker

```dockerfile
FROM jrottenberg/ffmpeg:6.1-ubuntu AS base

RUN apt-get update && apt-get install -y golang-go ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o /ms1-media-processor ./cmd/main.go

EXPOSE 8081

CMD ["/ms1-media-processor"]
```

**Important:** Use an FFmpeg-bundled base image (e.g., `jrottenberg/ffmpeg`) so FFmpeg is available in the container `PATH`.

---

## Key Implementation Notes for Claude

> This section is specifically to guide the AI building this service.

1. **Worker Pool Pattern:** Use a buffered channel of size `WORKER_COUNT` as a semaphore. Each goroutine should call `BRPOP` with a timeout (e.g., 5 seconds) and process one job at a time. Do not spin up unbounded goroutines per job.

2. **FFmpeg via `os/exec`:** All FFmpeg calls must capture both `stdout` and `stderr`. Non-zero exit codes must be treated as errors. Log the full `stderr` output for debugging.

3. **Chunk Manifest:** The output of processing is a **chunk manifest** — a Go struct containing the S3 keys and time offsets for every chunk, audio file, and frame set. This manifest is serialized and sent to MS4 in the callback. MS4 stores it in PostgreSQL and passes it to MS2.

4. **S3 Paths are Conventions:** The exact S3 key structure (`processed/{video_id}/chunks/`, `/audio/`, `/frames/chunk_{N}/`) must be strictly followed because MS2 will be given these paths to download from. Any deviation will break the pipeline.

5. **Stateless Service:** MS1 holds no database or persistent state. All state lives in Redis (job queue) and S3 (artifacts). The service can be horizontally scaled by running multiple replicas — they will each independently consume from the Redis queue.

6. **Cleanup is Mandatory:** Local `/tmp` files must be deleted after every job (success or failure) to prevent disk exhaustion in long-running containers.

7. **MS4 Callback is the Single Source of Truth:** MS1 must not skip the callback even in failure cases. MS4 drives all workflow state transitions in PostgreSQL. If the callback cannot be delivered after retries, push a failure event to the dead-letter queue `media_processing_dlq`.

8. **`start_time_seconds` and `end_time_seconds` per chunk:** These are critical. MS2 uses them to anchor transcript timestamps to the original video timeline. Calculate them as `chunk_index * CHUNK_DURATION_SECONDS` and `(chunk_index + 1) * CHUNK_DURATION_SECONDS` (cap the last chunk at actual video duration).

9. **Frame S3 Key Naming Convention:** Frame keys must encode their chunk index and frame number so MS2/MS3 can reconstruct the exact timestamp. Recommended: `frames/chunk_{chunk_index:03d}/frame_{frame_number:04d}.jpg`. Frame timestamp = `start_time_seconds + (frame_number - 1)` seconds.

10. **No direct communication with MS2:** MS1 does not call MS2. It only uploads to S3 and calls back MS4. MS4 (or a separate orchestration step) triggers MS2.
