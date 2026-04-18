# NeuroStream MS3

MS3 is the search and discovery service for NeuroStream. It accepts transcript chunks and embeddings from MS2, stores them, and serves search and retrieval endpoints for downstream services.

## Default local port

- `http://localhost:8003` (Docker Compose host mapping to container port `8000`)

## Endpoints

- `GET /health`
	- Task: Liveness/health check.
	- Also reports which storage backend is active (e.g. `postgres`).

- `POST /index`
	- Task: Ingest transcript chunks + embeddings for a video and persist them.
	- Validates embedding length matches `EMBEDDING_DIMENSIONS` (default `768`).
	- Expected outcome: video transitions to a `ready` state for search.

- `GET /search`
	- Task: Return ranked results using text and/or embedding similarity plus optional metadata filters.
	- Common query params:
		- `q`/`query` (free text)
		- `query_embedding` (comma-separated floats)
		- `video_id`, `language`, `title_contains`, `source`, `limit`

- `GET /video/{video_id}/status`
	- Task: Return indexing readiness/status for a video.

- `GET /video/{video_id}/chunks`
	- Task: Return all stored chunks for a video (useful for debugging and downstream context building).

- `GET /video/{video_id}/context`
	- Task: Build formatted context blocks (RAG-style) for a video, optionally guided by a query or query embedding.

## Environment

- `DATABASE_URL`
- `MS4_BASE_URL`
- `EMBEDDING_DIMENSIONS` (default `768`)
- `SEARCH_DEFAULT_LIMIT` (default `5`)
- `SEARCH_MAX_LIMIT` (default `20`)
- `ALLOW_IN_MEMORY_FALLBACK` (default `true`)

If `DATABASE_URL` is not set, the service falls back to an in-memory repository so the API can still be exercised locally.

## Local Run

```bash
uv sync
uvicorn app.main:app --reload
```
