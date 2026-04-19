# NeuroStream Backend (FastAPI)

This backend has been migrated from Express to FastAPI and is managed with `uv`.

## Prerequisites

- Python 3.11+
- `uv` installed
- Docker services running (`postgres`, `redis`)
- AWS S3 bucket + credentials (or any S3-compatible storage)

## Setup

```bash
cd backend
cp .env.example .env
uv sync
```

## Run (development)

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 4000
```

## Seed demo user

```bash
uv run python -m app.seed
```

Demo credentials after seed:

- Email: `demo@neurostream.ai`
- Password: `DemoPassword123!`
