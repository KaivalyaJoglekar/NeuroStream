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

## Tests

```bash
pytest tests/ -v
```
