# NeuroStream MS5 — Personalized Video Analytics

> Per-user behavioral analytics & smart highlights service.

See [MS5_README.md](../MS5_README.md) for full specification.

## Quick Start

```bash
# 1. Copy env file
cp .env.example .env

# 2. Start with Docker Compose
docker-compose up -d

# 3. Or run locally
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8085 --reload
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/events` | Ingest user interaction event |
| GET | `/api/v1/analytics/{user_id}/{video_id}` | Full analytics summary |
| GET | `/api/v1/analytics/{user_id}/{video_id}/highlights` | Smart highlights only |
| GET | `/api/v1/analytics/{user_id}/{video_id}/queries` | Query history |
| POST | `/api/v1/analytics/{user_id}/{video_id}/recompute` | Force recompute |
| GET | `/health` | Health check |

## Input Contract From MS4

MS5 expects user interaction events to be forwarded by MS4 to:

- Method: `POST`
- Endpoint: `/api/v1/events`
- Header: `X-Internal-Secret: <shared-secret>`

### Request body

```json
{
	"user_id": "<ms4-user-id>",
	"video_id": "<ms4-video-id>",
	"event_type": "PLAY|PAUSE|SEEK|REPLAY|SEARCH",
	"timestamp_sec": 42.0,
	"query_text": "required only for SEARCH",
	"session_id": "optional-ms4-session-id"
}
```

### Validation rules

- `timestamp_sec` is required for all events.
- `query_text` is required when `event_type` is `SEARCH`.
- Missing or invalid `X-Internal-Secret` returns `403`.

### Minimal cURL example

```bash
curl -X POST "http://localhost:8085/api/v1/events" \
	-H "Content-Type: application/json" \
	-H "X-Internal-Secret: your_shared_internal_secret" \
	-d '{
		"user_id": "usr_123",
		"video_id": "vid_456",
		"event_type": "SEARCH",
		"timestamp_sec": 125.4,
		"query_text": "key insight",
		"session_id": "ms4-web-usr_123"
	}'
```

## Tests

```bash
pytest tests/ -v
```
