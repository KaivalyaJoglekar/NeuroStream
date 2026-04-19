# NeuroStream MS6 — The Brain

> Agentic RAG orchestrator powered by Spring Boot + Gemini API.

MS6 is the intelligence layer of NeuroStream. It receives natural-language questions, retrieves relevant video transcript chunks from **MS3**, and orchestrates a multi-agent pipeline of Gemini LLM calls to produce cited, conversational answers.

See [PRD.md](PRD.md) for the full product requirements document.

## Default local port

- `http://localhost:8086`

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Liveness check + agent roster |
| POST | `/api/v1/chat` | Single-video conversational Q&A |
| POST | `/api/v1/search-chat` | Cross-library search + answer |
| POST | `/api/v1/summarize` | Full video summarization (Map-Reduce) |
| POST | `/api/v1/research` | Deep agentic research with iterative retrieval |

## Agent Pipeline

```
Retriever (MS3 HTTP) → Analyzer (Gemini) → Synthesizer (Gemini) → Citation Linker (Gemini)
```

Each "agent" is a focused Gemini API call with a tailored system prompt. They chain:
each step's output becomes the next step's input.

## Prerequisites

- Java 21+
- Maven
- MS3 running on `localhost:8003`
- `GEMINI_API_KEY` environment variable

## Quick Start

```bash
cd ms6
cp .env.example .env
# Edit .env and set your GEMINI_API_KEY

./mvnw spring-boot:run
```

## Environment

See [.env.example](.env.example) for all configurable variables.

| Variable | Required | Default |
|----------|----------|---------|
| `GEMINI_API_KEY` | Yes | — |
| `MS3_BASE_URL` | No | `http://localhost:8003` |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` |
| `AWS_REGION` | No | `us-east-1` |
| `AWS_ENDPOINT` | No | — |
| `AWS_BUCKET_NAME` | No | — |
| `AWS_ACCESS_KEY` | No | — |
| `AWS_SECRET_KEY` | No | — |
| `AWS_S3_PATH_STYLE` | No | `true` |

These S3-compatible variables are intended for Backblaze/Filebase-style object storage integration.
