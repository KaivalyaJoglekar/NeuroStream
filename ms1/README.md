# NeuroStream MS1 — Media Processor

MS1 is a Go + FFmpeg worker service that transforms a raw uploaded video into AI-ready artifacts (video chunks, extracted audio, sampled frames). It consumes jobs from Redis and reads/writes objects from S3-compatible storage (MinIO locally).

For the full deep-dive spec, see `MS1_README.md` in this folder.

## Default local ports

- MS1 health server: `http://localhost:8081/health`
- MinIO (S3 API): `http://localhost:9000`
- MinIO Console (UI): `http://localhost:9001`

> Note: in `ms1/docker-compose.yml`, Redis is **not** exposed to the host to avoid port clashes with other stacks.

## Inputs & outputs

### Inputs
- **Redis queue**: list `media_processing_jobs`
	- MS1 pops a JSON payload containing at least:
		- `job_id`, `video_id`, `user_id`
		- `s3_raw_path` (key in bucket, e.g. `raw-uploads/sample.mp4`)
- **Object storage (S3/MinIO)**
	- Reads the video object from: `S3_BUCKET_NAME` + `s3_raw_path`

### Outputs
- **Object storage (S3/MinIO)**
	- Writes derived artifacts under `S3_PROCESSED_PREFIX` (default: `processed/`), typically:
		- `processed/<video_id>/...`
- **Optional MS4 callback**
	- Posts job completion/failure to `MS4_CALLBACK_URL` (safe to ignore for local smoke tests if MS4 isn’t running).

## Endpoints

- `GET /health`
	- Task: liveness/health check for the container.
	- Returns basic operational counters (`workers_active`, `jobs_processed`).

## Quick start (Docker Compose)

```bash
cd ms1
cp .env.example .env
docker compose up -d
```

## Run locally (no Docker)

Requires: Go, FFmpeg, Redis, and S3-compatible storage (or real S3).

```bash
cd ms1
cp .env.example .env
go mod download
go run ./cmd/main.go
```

## Enqueue a test job

If you started via Docker Compose, Redis is inside the compose network. The most reliable way to push a job is:

```bash
docker exec ms1-redis redis-cli LPUSH media_processing_jobs \
'{"job_id":"test_001","video_id":"00000000-0000-0000-0000-000000000101","user_id":"local","s3_raw_path":"raw-uploads/sample.mp4","original_filename":"sample.mp4","content_type":"video/mp4","file_size_bytes":0,"enqueued_at":"2026-04-18T00:00:00Z"}'
```

Then watch logs:

```bash
docker logs -f ms1-media-processor
```
