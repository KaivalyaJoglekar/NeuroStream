# NeuroStream MS7 — PDF Export Service

Converts AI outputs from **MS6** into downloadable PDF reports, uploads them to a dedicated S3 bucket, and returns a time-limited presigned URL.

## Default local port
`http://localhost:8007`

## Endpoints

| Method | Endpoint | MS6 Source | Description |
|--------|----------|------------|-------------|
| GET | `/health` | — | Liveness check |
| POST | `/api/v1/export/chat` | `/api/v1/chat` or `/search-chat` | Q&A report PDF |
| POST | `/api/v1/export/summarize` | `/api/v1/summarize` | Video summary PDF |
| POST | `/api/v1/export/research` | `/api/v1/research` | Research report PDF |

## Flow

```
Frontend → MS6 response → POST /api/v1/export/{type} → PDF built → uploaded to S3 → presigned URL returned → user downloads
```

## S3 Setup

MS7 uses its **own dedicated S3 bucket** with its own IAM credentials — completely separate from the MinIO/S3 bucket used by MS1/MS2.

1. Create bucket in AWS console: e.g. `neurostream-exports`
2. Create an IAM user with `s3:PutObject` + `s3:GetObject` permissions scoped to that bucket
3. Drop credentials into `.env`

## Quick Start

```bash
cd ms7
cp .env.example .env
# Edit .env with your AWS creds

pip install -r requirements.txt
python run.py
```

## Deploy on Render (Important)

MS7 depends on `pydantic-core` wheels. If Render uses Python 3.14, it may try a Rust source build and fail.

Use Python `3.11.x` for reliable builds:

1. In Render service settings, set environment variable `PYTHON_VERSION=3.11.11`.
2. Keep build command: `pip install -r requirements.txt`.
3. Keep start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
4. If a previous failed build is cached, clear build cache and redeploy.

## Example Request

```json
POST /api/v1/export/chat
{
  "title": "How does photosynthesis work?",
  "question": "How does photosynthesis work?",
  "answer": "Photosynthesis converts light energy into...",
  "citations": [
    { "start_time": 62.0, "end_time": 90.0, "text": "Plants absorb sunlight...", "source": "audio" }
  ]
}
```

## Example Response

```json
{
  "download_url": "https://neurostream-exports.s3.amazonaws.com/chat/abc123.pdf?...",
  "s3_key": "chat/abc123.pdf",
  "expires_in_seconds": 3600
}
```

## Environment Variables

| Variable | Required | Default |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | Yes | — |
| `AWS_SECRET_ACCESS_KEY` | Yes | — |
| `AWS_REGION` | No | `us-east-1` |
| `S3_EXPORT_BUCKET` | No | `neurostream-exports` |
| `PRESIGNED_URL_EXPIRY` | No | `3600` (1 hour) |
