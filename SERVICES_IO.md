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

## How the services connect (current repo wiring)

- **MS1 > (Redis + S3/MinIO)**
  - MS1 reads job messages from Redis and reads/writes objects in S3/MinIO.
- **MS2 > MS3 (HTTP)**
  - MS2 sends normalized chunks+embeddings to MS3s `POST /index`.
- **MS4 (not in this repo)**
  - Several services can notify MS4, but MS4 is optional for local smoke tests.

> Note: MS3 does **not** read MinIO directly; it only indexes what it receives via `POST /index`.
