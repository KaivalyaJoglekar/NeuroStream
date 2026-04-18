# NeuroStream MS1 — Media Processor

> High-concurrency video chunking & frame extraction service.

See [MS1_README.md](../MS1_README.md) for full specification.

## Quick Start

```bash
# 1. Copy env file
cp .env.example .env

# 2. Start with Docker Compose (includes Redis + MinIO)
docker-compose up -d

# 3. Or run locally (requires FFmpeg, Redis, MinIO)
go mod download
go run ./cmd/main.go
```

## Health Endpoint

```
GET :8081/health
```

## Testing a Job

```bash
redis-cli LPUSH media_processing_jobs '{"job_id":"test_001","video_id":"vid_test","user_id":"usr_test","s3_raw_path":"raw-uploads/usr_test/vid_test/sample.mp4","original_filename":"sample.mp4","content_type":"video/mp4","file_size_bytes":10485760,"enqueued_at":"2025-04-12T10:00:00Z"}'
```
