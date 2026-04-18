# MS5 — NeuroStream Personalized Video Analytics Service

> **NeuroStream Microservice 5 | Language: Python | Framework: FastAPI | Role: Per-User Behavioral Analytics & Smart Highlights**

---

## Table of Contents

1. [Overview](#overview)
2. [Responsibilities](#responsibilities)
3. [Architecture & Position in Pipeline](#architecture--position-in-pipeline)
4. [Tech Stack](#tech-stack)
5. [Directory Structure](#directory-structure)
6. [Environment Variables](#environment-variables)
7. [Database Schema](#database-schema)
8. [API Endpoints](#api-endpoints)
9. [Event Schema](#event-schema)
10. [Analytics Logic](#analytics-logic)
11. [Smart Highlights Algorithm](#smart-highlights-algorithm)
12. [Data Flow (Step-by-Step)](#data-flow-step-by-step)
13. [Redis Integration](#redis-integration)
14. [Error Handling](#error-handling)
15. [Local Development](#local-development)
16. [Docker](#docker)
17. [Key Implementation Notes for Claude](#key-implementation-notes-for-claude)

---

## Overview

MS5 is the **behavioral intelligence layer** of NeuroStream. It tracks per-user, per-video interactions — including search queries, timestamp seeks, segment revisits, and playback patterns — and transforms this raw behavioral data into **personalized insights**: smart highlights, "your important sections," and a searchable query history per video.

Unlike MS3 (which handles global semantic search), MS5 is entirely **user-scoped**: it answers the question *"What does THIS user care about in THIS video?"*

MS5 is a **FastAPI** service backed by **PostgreSQL** for durable behavioral storage and **Redis** for real-time event ingestion.

---

## Responsibilities

| # | Responsibility | Description |
|---|---|---|
| 1 | **Event Ingestion** | Accept user interaction events (searches, seeks, replays) from the frontend via MS4 routing |
| 2 | **Timestamp Frequency Tracking** | Record and aggregate how often each timestamp/segment is accessed by a user per video |
| 3 | **Revisited Segment Detection** | Identify segments a user has replayed multiple times |
| 4 | **Query History Logging** | Log every search query a user makes against a video, with timestamps |
| 5 | **Important Moments Computation** | Compute a ranked list of important timestamps based on behavioral signals |
| 6 | **Smart Highlights Generation** | Generate a condensed list of the most behaviorally significant segments |
| 7 | **"Your Important Sections" API** | Serve the top N personalized sections for a user+video pair |
| 8 | **Analytics Summary API** | Provide a full analytics dashboard payload for a video |

---

## Architecture & Position in Pipeline

```
[User Frontend]
      |
      | interaction events (search, seek, replay)
      v
[MS4 - Node.js: User Workflow]
      |
      | POST /events  (proxies user events to MS5)
      v
[MS5 - FastAPI: Personalized Analytics]
      |
      |── writes behavioral events ──→ [PostgreSQL: analytics tables]
      |── reads segment metadata ────→ [PostgreSQL: video/chunk metadata from MS4]
      |── caches hot analytics ──────→ [Redis]
      |
      | serves personalized insights
      v
[MS4 - Node.js]  ──→  [User Frontend]
```

**MS5 does NOT interact directly with MS1, MS2, or MS3.** It receives events via MS4 and reads video metadata (chunk time offsets, transcript segment references) from the shared PostgreSQL database.

---

## Tech Stack

| Component | Technology | Purpose |
|---|---|---|
| Language | Python 3.11+ | Application logic |
| Framework | FastAPI | REST API |
| ORM | SQLAlchemy 2.0 (async) | PostgreSQL access |
| Database | PostgreSQL | Durable behavioral event storage |
| Cache | Redis (`redis-py` async) | Hot analytics caching, dedup |
| Migrations | Alembic | Schema versioning |
| Validation | Pydantic v2 | Request/response models |
| Task Queue | (optional) Celery + Redis | Heavy analytics recomputation |
| Containerization | Docker | Deployment |

---

## Directory Structure

```
ms5-analytics/
├── app/
│   ├── main.py                       # FastAPI app init, router registration
│   ├── config.py                     # Settings via pydantic-settings
│   ├── database.py                   # Async SQLAlchemy engine + session factory
│   ├── redis_client.py               # Redis connection pool
│   │
│   ├── routers/
│   │   ├── events.py                 # POST /events — ingest user interaction
│   │   ├── analytics.py              # GET analytics endpoints
│   │   └── health.py                 # GET /health
│   │
│   ├── models/
│   │   ├── db_models.py              # SQLAlchemy ORM table definitions
│   │   └── schemas.py                # Pydantic request/response schemas
│   │
│   ├── services/
│   │   ├── event_service.py          # Writes events to PostgreSQL
│   │   ├── analytics_service.py      # Computes important moments, highlights
│   │   ├── highlight_service.py      # Smart highlights generation logic
│   │   └── cache_service.py          # Redis cache read/write helpers
│   │
│   └── utils/
│       └── time_utils.py             # Timestamp bucketing, segment math
│
├── alembic/
│   ├── env.py
│   └── versions/
│       └── 001_initial_analytics_tables.py
│
├── tests/
│   ├── test_events.py
│   └── test_analytics.py
│
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── alembic.ini
└── README.md
```

---

## Environment Variables

```env
# Application
APP_ENV=development
APP_PORT=8085

# PostgreSQL (shared with MS4 for video metadata reads)
DATABASE_URL=postgresql+asyncpg://user:password@postgres:5432/neurostream_db

# Redis
REDIS_URL=redis://redis:6379/1

# Analytics Config
TIMESTAMP_BUCKET_SECONDS=5        # Group timestamps into N-second buckets for aggregation
MIN_REVISIT_COUNT=2               # Minimum replays to flag a segment as "revisited"
TOP_HIGHLIGHTS_COUNT=5            # Number of smart highlights to generate per video
IMPORTANT_SECTIONS_COUNT=10       # Max "important sections" returned to user
CACHE_TTL_SECONDS=300             # TTL for cached analytics results (5 minutes)

# Internal Auth (shared secret with MS4)
INTERNAL_API_SECRET=your_shared_internal_secret
```

---

## Database Schema

MS5 owns the following PostgreSQL tables. It also reads (read-only) from MS4-owned tables (`videos`, `video_chunks`).

### Table: `user_video_events`

Stores every raw interaction event from a user on a video.

```sql
CREATE TABLE user_video_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         VARCHAR(64) NOT NULL,
    video_id        VARCHAR(64) NOT NULL,
    event_type      VARCHAR(32) NOT NULL,   -- 'SEEK', 'REPLAY', 'SEARCH', 'PAUSE', 'PLAY'
    timestamp_sec   FLOAT,                  -- Video position at time of event (seconds)
    query_text      TEXT,                   -- For SEARCH events only
    session_id      VARCHAR(64),            -- Browser/app session identifier
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_uve_user_video ON user_video_events (user_id, video_id);
CREATE INDEX idx_uve_event_type ON user_video_events (event_type);
CREATE INDEX idx_uve_created_at ON user_video_events (created_at);
```

---

### Table: `user_video_analytics`

Stores computed analytics summaries (refreshed on demand or via background task).

```sql
CREATE TABLE user_video_analytics (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 VARCHAR(64) NOT NULL,
    video_id                VARCHAR(64) NOT NULL,
    important_timestamps    JSONB,          -- Ranked list of {timestamp_sec, score, reason}
    smart_highlights        JSONB,          -- [{start_sec, end_sec, label, score}]
    query_history           JSONB,          -- [{query_text, searched_at, result_timestamps}]
    revisited_segments      JSONB,          -- [{start_sec, end_sec, replay_count}]
    last_computed_at        TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, video_id)
);
```

---

### Read-Only References (MS4-owned tables)

MS5 reads from these to enrich analytics with metadata:

```sql
-- From MS4 (read-only for MS5)
videos (video_id, title, total_duration_seconds, user_id, created_at)
video_chunks (chunk_id, video_id, chunk_index, start_time_seconds, end_time_seconds)
```

---

## API Endpoints

All endpoints are prefixed with `/api/v1`.

---

### `POST /api/v1/events`

**Purpose:** Ingest a user interaction event. Called by MS4 on behalf of the frontend.

**Headers:**
```
Content-Type: application/json
X-Internal-Secret: {INTERNAL_API_SECRET}
```

**Request Body:**
```json
{
  "user_id": "usr_abc123",
  "video_id": "vid_xyz789",
  "event_type": "SEARCH",
  "timestamp_sec": 142.5,
  "query_text": "what is gradient descent",
  "session_id": "sess_def456"
}
```

**Event Types:**

| Event Type | Description | `timestamp_sec` | `query_text` |
|---|---|---|---|
| `SEEK` | User scrubbed to a position | Required | Null |
| `REPLAY` | User rewound/replayed a segment | Required | Null |
| `SEARCH` | User ran a search query on the video | Required (result position) | Required |
| `PAUSE` | User paused at a position | Required | Null |
| `PLAY` | User started/resumed playback | Required | Null |

**Response `201`:**
```json
{
  "event_id": "evt_ghi789",
  "status": "recorded"
}
```

---

### `GET /api/v1/analytics/{user_id}/{video_id}`

**Purpose:** Returns the full analytics summary for a user-video pair.

**Response `200`:**
```json
{
  "user_id": "usr_abc123",
  "video_id": "vid_xyz789",
  "important_sections": [
    {
      "rank": 1,
      "start_sec": 140,
      "end_sec": 155,
      "label": "Frequently searched section",
      "score": 9.4,
      "signals": ["SEARCH_HIT", "REPLAY"]
    },
    {
      "rank": 2,
      "start_sec": 320,
      "end_sec": 340,
      "label": "Revisited segment",
      "score": 7.1,
      "signals": ["REPLAY", "PAUSE"]
    }
  ],
  "smart_highlights": [
    {
      "start_sec": 140,
      "end_sec": 155,
      "label": "Gradient descent explanation",
      "score": 9.4
    }
  ],
  "query_history": [
    {
      "query_text": "what is gradient descent",
      "searched_at": "2025-04-12T10:45:00Z",
      "result_timestamp_sec": 142.5
    }
  ],
  "revisited_segments": [
    {
      "start_sec": 140,
      "end_sec": 155,
      "replay_count": 4
    }
  ],
  "last_computed_at": "2025-04-12T11:00:00Z"
}
```

---

### `GET /api/v1/analytics/{user_id}/{video_id}/highlights`

**Purpose:** Returns only the smart highlights list (lightweight endpoint for frontend player overlay).

**Response `200`:**
```json
{
  "video_id": "vid_xyz789",
  "highlights": [
    { "start_sec": 140, "end_sec": 155, "label": "Gradient descent", "score": 9.4 },
    { "start_sec": 320, "end_sec": 340, "label": "Backpropagation walkthrough", "score": 7.1 }
  ]
}
```

---

### `GET /api/v1/analytics/{user_id}/{video_id}/queries`

**Purpose:** Returns the full query history for a user on a specific video.

**Response `200`:**
```json
{
  "video_id": "vid_xyz789",
  "query_history": [
    {
      "query_text": "what is gradient descent",
      "searched_at": "2025-04-12T10:45:00Z",
      "result_timestamp_sec": 142.5
    },
    {
      "query_text": "learning rate tuning",
      "searched_at": "2025-04-12T10:52:00Z",
      "result_timestamp_sec": 310.0
    }
  ]
}
```

---

### `POST /api/v1/analytics/{user_id}/{video_id}/recompute`

**Purpose:** Force-recomputes analytics for a user-video pair (e.g., called after a batch of new events). Invalidates Redis cache.

**Response `202`:**
```json
{
  "status": "recompute_triggered",
  "video_id": "vid_xyz789"
}
```

---

### `GET /health`

**Response `200`:**
```json
{
  "status": "ok",
  "db": "connected",
  "redis": "connected"
}
```

---

## Event Schema

### Pydantic Model

```python
from pydantic import BaseModel
from typing import Optional
from enum import Enum

class EventType(str, Enum):
    SEEK = "SEEK"
    REPLAY = "REPLAY"
    SEARCH = "SEARCH"
    PAUSE = "PAUSE"
    PLAY = "PLAY"

class UserEventRequest(BaseModel):
    user_id: str
    video_id: str
    event_type: EventType
    timestamp_sec: Optional[float] = None
    query_text: Optional[str] = None
    session_id: Optional[str] = None
```

---

## Analytics Logic

### Timestamp Bucketing

Raw `timestamp_sec` values are bucketed into `TIMESTAMP_BUCKET_SECONDS`-second windows for aggregation.

```python
def bucket_timestamp(ts: float, bucket_size: int = 5) -> int:
    """Returns the start of the bucket this timestamp falls into."""
    return int(ts // bucket_size) * bucket_size
```

**Example:** With `TIMESTAMP_BUCKET_SECONDS=5`, timestamps 140.1, 141.8, 143.5 all fall into bucket `140`.

---

### Importance Score Calculation

Each timestamp bucket is scored based on weighted behavioral signals:

```python
SIGNAL_WEIGHTS = {
    "SEARCH_HIT":   5.0,    # Search result landed here — strongest signal
    "REPLAY":       3.0,    # User rewound to this point
    "SEEK":         1.5,    # User scrubbed to this point
    "PAUSE":        1.0,    # User paused here
}

def compute_bucket_score(events_in_bucket: list[Event]) -> float:
    score = 0.0
    for event in events_in_bucket:
        weight = SIGNAL_WEIGHTS.get(event.event_type, 0.0)
        score += weight
    return score
```

---

### Important Sections Definition

A section is a contiguous group of scored buckets. Adjacent high-scoring buckets are merged into a single "important section" using a sliding window:

```
Algorithm:
1. Compute scores for all timestamp buckets (grouped by TIMESTAMP_BUCKET_SECONDS).
2. Sort buckets by score descending.
3. Take top N buckets.
4. Merge adjacent buckets (within 2 bucket-lengths of each other) into sections.
5. Return sections with: start_sec, end_sec, total_score, contributing signals.
```

---

### Revisited Segments Detection

A segment is "revisited" if the user has `REPLAY` or `SEEK` events landing in the same bucket `>= MIN_REVISIT_COUNT` times.

```python
def find_revisited_segments(events: list[Event], min_count: int = 2) -> list[dict]:
    from collections import Counter
    replay_seeks = [e for e in events if e.event_type in ("REPLAY", "SEEK")]
    bucket_counts = Counter(bucket_timestamp(e.timestamp_sec) for e in replay_seeks)
    return [
        {"start_sec": bucket, "end_sec": bucket + BUCKET_SIZE, "replay_count": count}
        for bucket, count in bucket_counts.items()
        if count >= min_count
    ]
```

---

## Smart Highlights Algorithm

Smart highlights are a condensed subset of important sections, limited to `TOP_HIGHLIGHTS_COUNT` entries. They represent the moments most worth reviewing.

```
1. Compute all important sections (from above).
2. Filter: only include sections with score >= threshold (e.g., mean score of all sections).
3. Sort by score descending.
4. Take top N = TOP_HIGHLIGHTS_COUNT.
5. Enrich each highlight with a label:
     - If the section has SEARCH_HIT events: use the most common query_text as the label.
     - Otherwise: label as "Frequently revisited" or "Key moment".
6. Return highlights with: start_sec, end_sec, label, score.
```

---

## Data Flow (Step-by-Step)

```
EVENT INGESTION FLOW:

1. Frontend user performs an action (search, seek, replay)
        ↓
2. MS4 receives the interaction and proxies it to MS5 POST /events
        ↓
3. MS5 validates the event (Pydantic)
        ↓
4. MS5 writes the event to `user_video_events` table in PostgreSQL
        ↓
5. MS5 appends the raw event to a Redis list
   key: `events:{user_id}:{video_id}` (for fast recent-event access)
        ↓
6. MS5 increments a Redis counter:
   key: `bucket_score:{user_id}:{video_id}:{bucket}` (for real-time scoring)
        ↓
7. Return 201 to MS4


ANALYTICS READ FLOW:

1. Frontend requests "Your Important Sections" for a video
        ↓
2. MS4 proxies GET /analytics/{user_id}/{video_id} to MS5
        ↓
3. MS5 checks Redis cache key `analytics:{user_id}:{video_id}`
     - Cache HIT → return cached result immediately
     - Cache MISS → proceed to step 4
        ↓
4. MS5 queries PostgreSQL `user_video_events` for all events (user, video)
        ↓
5. MS5 runs analytics computation:
     a. Bucket timestamps
     b. Score buckets
     c. Merge into important sections
     d. Find revisited segments
     e. Generate smart highlights
     f. Pull query history
        ↓
6. MS5 writes result to Redis cache (TTL = CACHE_TTL_SECONDS)
        ↓
7. MS5 upserts result into `user_video_analytics` table
        ↓
8. Return analytics response to MS4 → Frontend
```

---

## Redis Integration

| Key Pattern | Type | Purpose | TTL |
|---|---|---|---|
| `analytics:{user_id}:{video_id}` | String (JSON) | Cached full analytics response | 300s |
| `bucket_score:{user_id}:{video_id}:{bucket_ts}` | String (float) | Real-time bucket score counter | 24h |
| `events:{user_id}:{video_id}` | List | Last 100 raw events (fast recent access) | 24h |

**Redis is a performance cache only.** PostgreSQL is the source of truth. Redis data loss does not cause data loss — analytics can always be recomputed from PostgreSQL.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Invalid `event_type` | FastAPI returns `422 Unprocessable Entity` |
| `timestamp_sec` missing for non-SEARCH event | Return `422` with field error |
| PostgreSQL write failure | Log error, return `500`; do NOT silently discard events |
| Redis unavailable | Log warning; fall through to PostgreSQL-only path (no caching) |
| `video_id` not found in `videos` table | Return `404 Not Found` |
| Analytics not yet computed | Return `200` with empty/null fields and `last_computed_at: null` |
| Recompute in progress | Return `202 Accepted` with `status: "already_computing"` |

---

## Local Development

### Prerequisites

- Python 3.11+
- PostgreSQL 15+
- Redis
- Docker (optional)

### Setup

```bash
# 1. Enter directory
cd ms5-analytics

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Copy env file
cp .env.example .env
# Edit .env with local DB and Redis URLs

# 5. Run migrations
alembic upgrade head

# 6. Start the service
uvicorn app.main:app --host 0.0.0.0 --port 8085 --reload
```

### Sending a Test Event

```bash
curl -X POST http://localhost:8085/api/v1/events \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: your_shared_internal_secret" \
  -d '{
    "user_id": "usr_test",
    "video_id": "vid_test_001",
    "event_type": "SEARCH",
    "timestamp_sec": 142.5,
    "query_text": "gradient descent",
    "session_id": "sess_local_001"
  }'
```

### Fetching Analytics

```bash
curl http://localhost:8085/api/v1/analytics/usr_test/vid_test_001
```

---

## Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8085

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8085"]
```

---

## Key Implementation Notes for Claude

> This section is specifically to guide the AI building this service.

1. **Event Volume:** Events can arrive at high frequency (every seek/pause = an event). The `POST /events` endpoint must be extremely fast — write to PostgreSQL asynchronously. Use SQLAlchemy async sessions (`AsyncSession`) with `asyncpg` driver. Never block on DB writes in the request path.

2. **Bucket Granularity is Configurable:** The `TIMESTAMP_BUCKET_SECONDS` env var controls how finely timestamps are grouped. At 5 seconds, a 90-minute video yields 1080 buckets. This is fine for PostgreSQL aggregation but keep it in mind when designing the `bucket_score` Redis key space.

3. **Analytics are Computed Lazily by Default:** Do not compute analytics on every event ingestion — this would be too expensive. Instead, compute on-demand when a GET analytics endpoint is called (with Redis caching). Optionally support a background Celery task for pre-computation.

4. **`SEARCH` Events are the Strongest Signal:** When a user searches and lands on a timestamp, that timestamp is the most valuable behavioral data point. Make sure `SEARCH_HIT` events are stored with both `query_text` AND `timestamp_sec` (the result position, not the position at time of typing).

5. **Redis Counters for Real-Time Score:** Maintain `INCRBYFLOAT` counters in Redis for each `(user_id, video_id, bucket_ts)` triplet. This allows near-real-time "trending moments" without hitting PostgreSQL on every event.

6. **Upsert Pattern for `user_video_analytics`:** Use PostgreSQL `INSERT ... ON CONFLICT (user_id, video_id) DO UPDATE` (upsert) when writing computed analytics. There should be exactly one row per `(user_id, video_id)` pair.

7. **No Direct Frontend Access:** MS5 is an internal service. All requests are proxied through MS4. The `X-Internal-Secret` header must be validated on every request. Return `403 Forbidden` if missing or wrong.

8. **Highlight Labels Come from Query Text:** When a segment has associated `SEARCH` events, the most frequent `query_text` among those events becomes the highlight label. This makes highlights human-readable. Fall back to generic labels ("Revisited moment", "Key section") when no search data is available.

9. **`last_computed_at` must be returned accurately:** The frontend uses this to decide whether to show a "Refreshing..." state. Always set it to the actual time the analytics object was computed, not the current request time.

10. **Idempotent Event Ingestion:** Consider adding a `client_event_id` field to the event request for deduplication (e.g., the frontend can assign a UUID to each event and MS5 can deduplicate using a Redis set with a short TTL). This prevents double-counting if the frontend retries a failed POST.

11. **Segment Boundary Alignment:** When merging scored buckets into "important sections," align section boundaries to chunk boundaries from the `video_chunks` table where possible. This makes it easier for MS2/MS3 to cross-reference section timestamps with transcript chunk data.

12. **Test with Synthetic Events:** Write a seed script that generates realistic event sequences (many SEARCHes and REPLAYs around a few key timestamps) to test that the highlight algorithm produces sane output before integrating with the frontend.
