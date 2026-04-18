# MS7 — PDF Export Service: Product Requirements Document

## Overview

MS7 is a lightweight, independent FastAPI microservice that acts as the final export layer in the NeuroStream pipeline. It accepts structured AI-generated content from **MS6** (The Brain), renders it into a professionally formatted PDF document, uploads it to a **dedicated AWS S3 bucket**, and returns a time-limited presigned URL for the user to download or share.

MS7 has no database, no persistent state, and no dependency on any other NeuroStream service except for receiving MS6 JSON payloads via HTTP. It is fully stateless and independently deployable.

---

## Goals

- Convert all three MS6 response types into downloadable PDFs with zero friction.
- Use a completely isolated S3 bucket with its own IAM credentials — no shared infra with MS1/MS2/MinIO.
- Keep the service minimal: no queues, no DB, no auth layer (auth is handled upstream by MS4).
- Be trivially deployable to AWS Lambda or Render.

---

## Non-Goals

- MS7 does **not** call MS6 directly. The caller (frontend or MS4 orchestrator) takes the MS6 response and forwards it.
- MS7 does **not** store PDF metadata or history.
- MS7 does **not** handle authentication — it trusts the caller.

---

## Default Port

`http://localhost:8007`

---

## Endpoints

### `GET /health`
Liveness check.
```json
{ "service": "neurostream-ms7", "status": "ok", "bucket": "neurostream-exports" }
```

---

### `POST /api/v1/export/chat`
Export a Q&A report from a MS6 `/chat` or `/search-chat` response.

**Request Body:**
```json
{
  "title": "My Q&A Report",
  "question": "What is explained in this video?",
  "answer": "The video explains...",
  "citations": [
    { "start_time": 62.0, "end_time": 90.0, "text": "...", "source": "audio" }
  ]
}
```

**Response:**
```json
{
  "download_url": "https://neurostream-exports.s3.amazonaws.com/chat/abc.pdf?...",
  "s3_key": "chat/abc.pdf",
  "expires_in_seconds": 3600
}
```

---

### `POST /api/v1/export/summarize`
Export a summary report from a MS6 `/summarize` response.

**Request Body:**
```json
{
  "video_id": "vid_abc",
  "title": "Video Summary",
  "summary": "This video covers...",
  "chapters": [
    { "title": "Intro", "start_time": 0, "end_time": 120, "summary": "..." }
  ]
}
```

---

### `POST /api/v1/export/research`
Export a research report from a MS6 `/research` response.

**Request Body:**
```json
{
  "topic": "Quantum Computing",
  "title": "Research Report",
  "report": "Based on the analyzed videos...",
  "sources_used": 14,
  "videos_analyzed": 3
}
```

---

## PDF Design

Generated using **fpdf2** (pure Python, no system dependencies like Cairo or Pango).

Each PDF includes:
- **Header:** NeuroStream branding + report title
- **Divider line**
- **Sections** with grey-filled headings
- **Body text** in Helvetica 10pt
- **Citations / Chapters** formatted with timestamps in `[MM:SS]` format

S3 key structure:
```
chat/     → Q&A reports
summary/  → Summarization reports
research/ → Research reports
```

---

## S3 Setup (Dedicated Bucket)

MS7 uses a **new AWS S3 bucket** completely separate from the MinIO instance used by MS1/MS2:

1. Create bucket: e.g. `neurostream-exports` in AWS Console.
2. Create an IAM user with the following inline policy:
```json
{
  "Effect": "Allow",
  "Action": ["s3:PutObject", "s3:GetObject"],
  "Resource": "arn:aws:s3:::neurostream-exports/*"
}
```
3. Add credentials to `.env` (see `.env.example`).

Presigned URLs expire after `PRESIGNED_URL_EXPIRY` seconds (default: 3600 = 1 hour).

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `AWS_ACCESS_KEY_ID` | ✅ | — | IAM access key for export bucket |
| `AWS_SECRET_ACCESS_KEY` | ✅ | — | IAM secret key for export bucket |
| `AWS_REGION` | No | `us-east-1` | S3 region |
| `S3_EXPORT_BUCKET` | No | `neurostream-exports` | Bucket name |
| `PRESIGNED_URL_EXPIRY` | No | `3600` | URL expiry in seconds |
| `PORT` | No | `8007` | Uvicorn port |

---

## File Structure

```
ms7/
├── app/
│   ├── __init__.py
│   ├── main.py          ← FastAPI app entry point
│   ├── config.py        ← Pydantic settings (loaded from .env)
│   ├── schemas.py       ← Request/response Pydantic models
│   ├── pdf_service.py   ← fpdf2 PDF builders (3 types)
│   ├── router.py        ← 3 export endpoint handlers + /health
│   └── s3_service.py    ← boto3 upload + presigned URL generation
├── run.py               ← Local dev entrypoint
├── requirements.txt
├── .env.example
├── PRD.md               ← This file
└── README.md
```

---

## Technology Stack

| Concern | Choice | Reason |
|---|---|---|
| Framework | FastAPI | Consistent with MS2/MS3/MS4/MS5 |
| PDF generation | fpdf2 | Pure Python, zero system deps, small install |
| S3 client | boto3 | Standard AWS SDK |
| Config | pydantic-settings | Type-safe env loading |

---

## Deployment

- **Recommended:** AWS Lambda (via Mangum adapter) — stateless, fast, scales to zero.
- **Alternative:** Render Web Service.
- No persistent storage, no migration, no queue — just install deps and run.

---

## Data Flow

```
[Frontend / MS4]
      │
      │  POST /api/v1/export/{type}
      │  (MS6 JSON response passed directly)
      ▼
   [MS7]
      │── pdf_service.py → builds PDF bytes (fpdf2)
      │── s3_service.py  → uploads to S3, generates presigned URL
      ▼
   [S3: neurostream-exports bucket]
      │
      ▼
   Presigned URL returned to caller → User downloads PDF
```
