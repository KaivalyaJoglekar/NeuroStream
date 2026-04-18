# NeuroStream – MS2 & MS3 Implementation Plan

## Project Context

**NeuroStream** is a polyglot microservices platform that converts raw video uploads into
searchable conversational intelligence. This plan covers the implementation of two services:

- **MS2** – AI Vision and NLP Perception (FastAPI / Python)
- **MS3** – Search and Discovery / Librarian (FastAPI / Python)

Both services live in the same repository under separate folders: `ms2/` and `ms3/`.

---

## Folder Structure

```
repo/
├── ms2/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   └── routes.py
│   │   ├── services/
│   │   │   ├── transcription.py
│   │   │   ├── vision.py
│   │   │   └── embeddings.py
│   │   ├── workers/
│   │   │   └── celery_worker.py
│   │   ├── models/
│   │   │   └── schemas.py
│   │   └── core/
│   │       ├── config.py
│   │       └── redis_client.py
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── .venv/              # created via `uv sync` inside ms2/
│   ├── Dockerfile
│   └── README.md
│
├── ms3/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   └── routes.py
│   │   ├── services/
│   │   │   ├── indexing.py
│   │   │   ├── search.py
│   │   │   └── metadata.py
│   │   ├── models/
│   │   │   └── schemas.py
│   │   └── core/
│   │       ├── config.py
│   │       └── db.py
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── .venv/              # created via `uv sync` inside ms3/
│   ├── Dockerfile
│   └── README.md
│
└── docker-compose.yml   # run both services + dependencies locally
```

---

## MS2 – AI Vision and NLP Perception

**Tech Stack:** Python, FastAPI, Celery, Redis, AWS S3, Whisper, Gemini 3 Flash, Gemini text-embedding-004

### Responsibilities
- Pull audio/video chunks from S3
- Generate **timestamped multi-lingual transcripts** from audio (via Whisper)
- Analyze **visual frames** using Gemini 3 Flash (object detection, on-screen text)
- Convert text + visual data into **high-dimensional vector embeddings** (via Gemini text-embedding-004)
- Send results downstream to MS3
- Report completion status back to MS4

### Inputs
| Source | Data |
|--------|------|
| Redis queue (from MS1) | Processing job with S3 path to media chunks |
| S3 | Audio segments and extracted keyframes |

### Outputs
| Destination | Data |
|-------------|------|
| MS3 (HTTP POST) | Transcripts, frame analysis, vector embeddings |
| MS4 (HTTP PATCH) | AI perception completion status |

### Key Implementation Steps

1. **Setup FastAPI app** with `/health` and `/status/{job_id}` endpoints
2. **Celery worker** consumes jobs from the Redis queue
3. **Transcription service** – download audio from S3, run Whisper, return timestamped JSON
4. **Vision service** – download keyframes from S3, call Gemini 3 Flash API, parse structured output
5. **Embeddings service** – encode transcript chunks + visual descriptions using Gemini `text-embedding-004` via `genai.embed_content()`
6. **Callback to MS3** – POST combined payload (transcript + embeddings + frame data)
7. **Callback to MS4** – PATCH job status to `ai_complete`

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/process` | Triggered by Celery or MS1 to start AI pipeline |
| GET | `/health` | Health check |
| GET | `/status/{job_id}` | Poll job status |

### Environment Variables
```
REDIS_URL=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=
GEMINI_API_KEY=
GEMINI_EMBEDDING_MODEL=models/text-embedding-004
MS3_BASE_URL=
MS4_BASE_URL=
```

### Key Dependencies (`pyproject.toml`)
```toml
[project]
dependencies = [
    "fastapi",
    "uvicorn",
    "celery[redis]",
    "boto3",
    "openai-whisper",
    "google-generativeai",
    "httpx",
    "pydantic",
    "python-dotenv",
]
```

### Local Setup
```bash
cd ms2
uv sync
```

### Dockerfile (uv)
```dockerfile
COPY pyproject.toml uv.lock .
RUN uv sync --frozen --no-dev
```

---

## MS3 – Search and Discovery (Librarian)

**Tech Stack:** Python, FastAPI, PostgreSQL + pgvector extension

### Responsibilities
- Receive and **index** transcript text, vector embeddings, and metadata from MS2
- Perform **low-latency vector similarity search** to locate content within videos
- Handle **hybrid search** – combine semantic (vector) and structured (metadata) queries
- Manage **searchable readiness status** (tell MS4 when a video is fully indexed)
- Serve MS6 (Agentic Researcher) with context retrieval for RAG workflows

### Inputs
| Source | Data |
|--------|------|
| MS2 (HTTP POST) | Transcripts, vector embeddings, frame metadata |
| MS4 / MS6 (HTTP GET) | Search queries, video IDs |

### Outputs
| Destination | Data |
|-------------|------|
| MS4 (HTTP PATCH) | Indexing completion / searchable readiness status |
| MS4 / MS6 (HTTP response) | Search results with timestamps and relevance scores |

### Key Implementation Steps

1. **Setup FastAPI app** with indexing and search route groups
2. **PostgreSQL + pgvector** – schema with tables for `videos`, `transcript_chunks`, `embeddings`
3. **Indexing service** – on receiving MS2 payload, persist transcript chunks + embeddings into pgvector table
4. **Vector search service** – accept a query embedding, run cosine similarity search via pgvector, return top-k chunks with timestamps
5. **Metadata query service** – filter by video ID, date, title, language alongside vector search (hybrid)
6. **Readiness callback** – PATCH MS4 when a video's index is complete and ready for user queries
7. **Context endpoint for MS6** – specialized retrieval route that returns formatted context blocks for RAG

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/index` | Receive and index transcript + embeddings from MS2 |
| GET | `/search` | Vector + metadata hybrid search |
| GET | `/video/{video_id}/status` | Get indexing readiness status for a video |
| GET | `/video/{video_id}/chunks` | Retrieve all chunks for a video (used by MS6) |
| GET | `/health` | Health check |

### Database Schema (PostgreSQL + pgvector)

```sql
-- videos table (synced from MS4)
CREATE TABLE videos (
    id UUID PRIMARY KEY,
    title TEXT,
    language TEXT,
    uploaded_at TIMESTAMP,
    indexed_at TIMESTAMP,
    status TEXT  -- 'indexing' | 'ready'
);

-- transcript_chunks table
CREATE TABLE transcript_chunks (
    id SERIAL PRIMARY KEY,
    video_id UUID REFERENCES videos(id),
    chunk_index INT,
    start_time FLOAT,
    end_time FLOAT,
    text TEXT,
    source TEXT  -- 'audio' | 'visual'
);

-- embeddings table
CREATE TABLE embeddings (
    id SERIAL PRIMARY KEY,
    chunk_id INT REFERENCES transcript_chunks(id),
    vector VECTOR(768)  -- dimension matches Gemini text-embedding-004 output
);
CREATE INDEX ON embeddings USING ivfflat (vector vector_cosine_ops);
```

### Environment Variables
```
DATABASE_URL=postgresql://user:pass@host:5432/neurostream
MS4_BASE_URL=
EMBEDDING_DIMENSIONS=768
```

### Key Dependencies (`pyproject.toml`)
```toml
[project]
dependencies = [
    "fastapi",
    "uvicorn",
    "asyncpg",
    "sqlalchemy[asyncio]",
    "pgvector",
    "psycopg2-binary",
    "httpx",
    "pydantic",
    "python-dotenv",
]
```

### Local Setup
```bash
cd ms3
uv sync
```

### Dockerfile (uv)
```dockerfile
COPY pyproject.toml uv.lock .
RUN uv sync --frozen --no-dev
```

---

## Inter-Service Flow (MS2 → MS3 → MS4)

```
MS1 (Go) ──► Redis queue
                  │
                  ▼
            MS2 Celery worker
              ├── S3: download audio + frames
              ├── Whisper: transcription
              ├── Gemini: vision analysis
              └── Gemini: embeddings (text-embedding-004)
                  │
          POST /index ▼
            MS3 (FastAPI)
              ├── Store chunks in PostgreSQL
              ├── Store vectors via pgvector
              └── PATCH /status → MS4 (indexed ✓)
                  │
          GET /search ▼  (on user query)
            MS6 (Agentic RAG)
```

---

## Development Order

1. Set up PostgreSQL with pgvector locally (Docker recommended)
2. Build **MS3 first** – indexing + search endpoints, test with mock data
3. Build **MS2** – transcription + vision + embeddings pipeline
4. Wire MS2 → MS3 callback
5. Wire MS3 → MS4 status callback
6. Integration test the full MS1 → MS2 → MS3 → MS4 chain

---

## Notes

- Both services use FastAPI for consistency and easy OpenAPI docs generation
- Each service has its own `pyproject.toml` + `uv.lock` + `.venv` — isolated environments, no dep conflicts
- Use `uv sync` inside each service folder locally; `uv sync --frozen --no-dev` in Dockerfiles
- Use `httpx` (async) for all inter-service HTTP calls to avoid blocking
- Celery in MS2 allows horizontal scaling of AI workers during traffic bursts (per scale requirements)
- pgvector's `ivfflat` index supports sub-second similarity search at project scale
- Keep secrets in `.env` files; never commit them to the repo