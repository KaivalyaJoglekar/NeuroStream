# NeuroStream services: inputs & outputs

This repo contains multiple microservices that together turn uploaded videos into searchable content.

> **Legend**
> - **Input** = what the service consumes (HTTP requests, queue messages, object-store paths)
> - **Output** = what the service produces (HTTP responses, queue messages, files written)

---

## Default local ports (Docker Compose)

These are the **host** ports exposed by the repo's compose files.

| Component | Host URL / Port | Notes |
|---|---:|---|
| MS1 (media processor) | `http://localhost:8081` | Root compose + `ms1/docker-compose.yml` expose this port. |
| MS2 (AI perception API) | `http://localhost:8002` | Maps to container port `8000`. |
| MS3 (index + search API) | `http://localhost:8003` | Maps to container port `8000`. |
| MS6 (agentic RAG / brain) | `http://localhost:8086` | Spring Boot; requires `GEMINI_API_KEY` and MS3 running. |
| MS7 (PDF export) | `http://localhost:8007` | FastAPI; requires dedicated AWS S3 export bucket credentials. |
| MinIO (S3 API) | `http://localhost:9000` | S3-compatible endpoint. |
| MinIO Console (UI) | `http://localhost:9001` | Web UI. |
| Postgres (pgvector) | `localhost:5432` | Exposed in root compose and MS2/MS3 stacks. |
| Redis | `localhost:6379` | **Only** exposed in the root `docker-compose.yml`; MS1/MS2 standalone stacks do not bind host ports to avoid clashes. |

---

## MS1  Media processor (Go)

**Purpose:** Takes a raw uploaded video, runs ffmpeg-based extraction, and writes derived artifacts (audio chunks, frames, etc.) back to object storage.

### Inputs
- **Redis queue** (`media_processing_jobs` list)
  - Example payload fields (observed from your local pushes):
    - `job_id`
    - `video_id`
    - `user_id`
    - `s3_raw_path` (e.g. `raw-uploads/sample.mp4`)  key inside the bucket
    - `original_filename`, `content_type`, `file_size_bytes`, `enqueued_at`
- **S3/MinIO object storage**
  - Reads the raw video from: `<bucket>/<s3_raw_path>`

### Outputs
- **S3/MinIO object storage**
  - Writes derived artifacts under a processed prefix (typical shape):
    - `processed/<video_id>/...` (audio chunks, frames, metadata)
- **(Optional) HTTP callback** to MS4
  - Notifies job status. If MS4 isnt running, this fails but MS1 can still produce artifacts.

### HTTP surface
- Typically a small health endpoint (varies by implementation/build). In local dev its mainly driven by Redis + S3/MinIO.

---

## MS2  AI perception (FastAPI, Python)

**Purpose:** Converts audio + frames into transcript chunks, visual descriptions, and embeddings, then forwards normalized indexing payloads to MS3.

### Inputs
- **HTTP** `POST /process`
  - Body: `ProcessRequest` (see `ms2/app/models/schemas.py`). At a high level:
    - `job_id`, `video_id`, optional `title`, `language`
    - `audio_segments[]`: items include timing + a reference like `s3_key`
    - `frame_images[]`: items include timing + a reference like `s3_key`
- **Redis** (optional)
  - If `MS2_PROCESS_INLINE=false`, MS2 enqueues/consumes jobs via Celery+Redis.
- **S3/MinIO** (optional, depending on mode)
  - In non-mock mode, MS2 can fetch audio/frame binaries from the object store.

### Outputs
- **HTTP response** from `POST /process`
  - `ProcessResponse`: mainly acknowledges job acceptance and whether MS3/MS4 were notified.
- **HTTP**  MS3 indexing call
  - MS2 calls MS3 to send transcript chunks + embeddings for indexing.
- **(Optional) HTTP callback** to MS4
  - Updates job status.

### Key endpoints
- `GET /health`  includes execution mode (`inline` vs `celery`).
- `POST /process`  starts processing.
- `GET /status/{job_id}`  last known job tracker status.

---

## MS3  Search & indexing (FastAPI, Python)

**Purpose:** Stores chunks + embeddings, exposes search and retrieval APIs.

### Inputs
- **HTTP** `POST /index`
  - Body: `IndexRequest` (see `ms3/app/models/schemas.py`). At a high level:
    - `job_id`, `video_id`, `title`, `language`
    - `chunks[]` with:
      - `chunk_index`, `start_time`, `end_time`, `text`, `source` (`audio|visual`)
      - optional `frame_ref`
      - `embedding` (must be length `EMBEDDING_DIMENSIONS`, default **768**)
- **HTTP** `GET /search`
  - Query params:
    - `query` (free text) and/or `query_embedding` (comma-separated floats)
    - optional metadata filters: `video_id`, `language`, `title_contains`, `source`
- **HTTP** retrieval endpoints
  - `GET /video/{video_id}/chunks`
  - `GET /video/{video_id}/status`
  - `GET /video/{video_id}/context`

### Outputs
- **Postgres + pgvector** (primary storage)
  - Persists videos, chunks, and embeddings.
- **HTTP responses**
  - `/index` returns `IndexResponse` (status + how many chunks indexed).
  - `/search` returns `SearchResponse` (ranked matches with timestamps).
  - `/video/...` endpoints return stored metadata and chunks.
- **(Optional) HTTP callback** to MS4
  - Communicates readiness/index status (`ms4_notified` flag in responses).

### Key endpoints
- `GET /health`  returns storage backend (e.g. `postgres`).
- `POST /index`  ingest.
- `GET /search`  query.

---

## MS6 — Agentic RAG / Brain (Spring Boot, Java 21)

**Purpose:** Multi-agent reasoning layer. Retrieves transcript context from MS3, chains multiple Gemini API calls to produce cited, conversational answers.

### Inputs
- **HTTP** `POST /api/v1/chat` — `video_id`, `question`, optional `conversation_history[]`
- **HTTP** `POST /api/v1/search-chat` — `question`, optional `language` (cross-library search)
- **HTTP** `POST /api/v1/summarize` — `video_id`, optional `style`
- **HTTP** `POST /api/v1/research` — `topic`, optional `video_ids[]`, optional `max_iterations`

### Outputs
- **HTTP responses** — all include `agent_trace` map for observability
  - `/chat` → `{ answer, citations[], agent_trace }`
  - `/summarize` → `{ video_id, summary, chapters[], agent_trace }`
  - `/research` → `{ report, sources_used, videos_analyzed, iterations_taken, agent_trace }`
- **Gemini API** (outbound) — REST calls per agent step (Analyzer, Synthesizer, CitationLinker, Planner, Summarizer)
- **MS3** (outbound) — calls `/search` and `/video/{id}/context` to fetch ranked transcript chunks

### Agent pipeline
```
Retriever (MS3 HTTP) → Analyzer (Gemini) → Synthesizer (Gemini) → CitationLinker (Gemini)
```

### Key endpoints
- `GET /health`
- `POST /api/v1/chat`
- `POST /api/v1/search-chat`
- `POST /api/v1/summarize`
- `POST /api/v1/research`

### Key env vars
- `GEMINI_API_KEY` (required)
- `MS3_BASE_URL` (default: `http://localhost:8003`)

---

## MS7 — PDF Export (FastAPI, Python)

**Purpose:** Stateless export layer. Accepts MS6 JSON responses, renders them into formatted PDF documents, uploads to a dedicated AWS S3 bucket, and returns a presigned download URL.

### Inputs
- **HTTP** `POST /api/v1/export/chat` — `title`, `question`, `answer`, `citations[]`
- **HTTP** `POST /api/v1/export/summarize` — `video_id`, `title`, `summary`, `chapters[]`
- **HTTP** `POST /api/v1/export/research` — `topic`, `title`, `report`, `sources_used`, `videos_analyzed`

### Outputs
- **AWS S3** (`neurostream-exports` bucket — separate from MS1/MS2 MinIO)
  - Uploads PDF under `chat/`, `summary/`, or `research/` prefix
- **HTTP response** — `{ download_url, s3_key, expires_in_seconds }`
  - `download_url` is a presigned S3 GET URL (default TTL: 3600s)

### Key endpoints
- `GET /health`
- `POST /api/v1/export/chat`
- `POST /api/v1/export/summarize`
- `POST /api/v1/export/research`

### Key env vars
- `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` (required — dedicated IAM user)
- `S3_EXPORT_BUCKET` (default: `neurostream-exports`)

---

## How the services connect (full pipeline wiring)

- **MS1 → (Redis + S3/MinIO)**
  - MS1 reads job messages from Redis and reads/writes objects in S3/MinIO.
- **MS2 → MS3 (HTTP)**
  - MS2 sends normalized chunks + embeddings to MS3's `POST /index`.
- **MS3 → MS6 (HTTP, inbound from MS6)**
  - MS6 calls MS3 `/search` and `/video/{id}/context` to retrieve ranked transcript chunks for the agent pipeline.
- **MS6 → Gemini API (HTTP, outbound)**
  - MS6 makes chained Gemini REST calls per agent step (Analyzer → Synthesizer → CitationLinker).
- **MS6 → MS7 (via frontend/MS4)**
  - The frontend or MS4 orchestrator passes MS6 JSON responses to MS7 for PDF export. MS7 does not call MS6 directly.
- **MS7 → AWS S3 (HTTP)**
  - MS7 uploads generated PDFs to the dedicated `neurostream-exports` S3 bucket and returns a presigned URL.
- **MS4 (not in this repo)**
  - Several services can notify MS4, but MS4 is optional for local smoke tests.

> Note: MS3 does **not** read MinIO directly; it only indexes what it receives via `POST /index`.
> Note: MS7 uses its own dedicated AWS S3 bucket — not the MinIO instance used by MS1/MS2.