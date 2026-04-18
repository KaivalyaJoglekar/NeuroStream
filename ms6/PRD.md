# MS6 — The Brain: Product Requirements Document

> **Service Type:** Agentic RAG Orchestrator  
> **Stack:** Spring Boot 4 · Java 21 · Gemini API (REST) · WebClient  
> **Upstream Dependency:** MS3 (Search & Indexing — FastAPI)  
> **Port:** `8086`

---

## 1. Purpose

MS6 is the intelligence layer of NeuroStream. It receives a natural-language question from a user (via the frontend or MS4 proxy), retrieves the relevant video transcript chunks from **MS3**, and orchestrates a **multi-agent pipeline** of Gemini LLM calls to produce a high-quality, cited, conversational answer.

MS3 is the file cabinet; **MS6 is the researcher who opens the cabinet, reads the files, thinks, and writes the report.**

---

## 2. What MS3 Already Provides (Data Contract)

MS6 does **not** own any transcript data. It pulls everything it needs from MS3 via HTTP.

### 2.1 `GET /search` — Global Vector + Text Search

Returns the **top-K chunks** ranked by cosine similarity and/or lexical overlap across the entire indexed corpus.

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `query` | `string` | Free-text search term |
| `query_embedding` | `string` | Comma-separated 768-dim float vector |
| `video_id` | `UUID` | (optional) Scope to a single video |
| `language` | `string` | (optional) Filter by language |
| `source` | `audio\|visual` | (optional) Filter by chunk origin |
| `limit` | `int` | Max results (server max: 20) |

**Response — `SearchResponse`:**

```json
{
  "results": [
    {
      "video_id": "uuid",
      "title": "Meeting Recording Q3",
      "language": "en",
      "chunk_id": 42,
      "chunk_index": 7,
      "start_time": 120.50,
      "end_time": 135.75,
      "text": "We decided to allocate 40% of the budget to marketing.",
      "source": "audio",
      "score": 0.891234,
      "frame_ref": null
    }
  ],
  "total": 10,
  "storage_backend": "postgres"
}
```

### 2.2 `GET /video/{video_id}/context` — RAG-Ready Context Blocks

Returns pre-formatted string blocks scoped to a **single video**, optionally ranked by a query. These blocks are designed to be dropped directly into an LLM system prompt.

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `query` | `string` | (optional) Focus context around this question |
| `query_embedding` | `string` | (optional) Comma-separated vector |
| `limit` | `int` | Number of context blocks (default 5) |

**Response — `ContextResponse`:**

```json
{
  "video_id": "uuid",
  "context_blocks": [
    "[120.50-135.75] We decided to allocate 40% of the budget to marketing. (source=audio, score=0.891)",
    "[200.00-215.30] The marketing team proposed three campaign strategies. (source=audio, score=0.754)"
  ],
  "storage_backend": "postgres"
}
```

### 2.3 `GET /video/{video_id}/chunks` — Full Transcript Dump

Returns **every chunk** for a video in chronological order. Used by MS6 for full-video summarization where the entire transcript is needed.

**Response — `ChunkResponse[]`:**

```json
[
  {
    "id": 1,
    "video_id": "uuid",
    "chunk_index": 0,
    "start_time": 0.0,
    "end_time": 15.5,
    "text": "Welcome everyone to the Q3 planning session.",
    "source": "audio",
    "frame_ref": null
  }
]
```

### 2.4 `GET /video/{video_id}/status` — Readiness Check

Returns whether a video has been fully indexed and is searchable.

```json
{
  "video_id": "uuid",
  "status": "ready",
  "indexed_at": "2026-04-18T12:00:00Z"
}
```

---

## 3. MS6 Endpoints (What MS6 Exposes)

### 3.1 `GET /health`

Standard liveness probe.

```json
{
  "service": "neurostream-ms6",
  "status": "ok",
  "agents": ["retriever", "analyzer", "synthesizer", "citation-linker"]
}
```

---

### 3.2 `POST /api/v1/chat` — Conversational Q&A (Single Video)

The primary endpoint. User asks a question about a specific video, MS6 orchestrates the full agent pipeline and returns a cited answer.

**Request:**

```json
{
  "video_id": "uuid",
  "user_id": "user-uuid",
  "question": "What were the three marketing strategies proposed?",
  "conversation_history": [
    { "role": "user", "content": "Tell me about marketing." },
    { "role": "assistant", "content": "The team discussed three strategies..." }
  ]
}
```

**Response:**

```json
{
  "answer": "The three marketing strategies proposed were: (1) influencer partnerships targeting Gen-Z demographics [2:00-2:15], (2) data-driven retargeting campaigns [3:30-3:45], and (3) a brand awareness push via podcast sponsorships [5:10-5:25].",
  "citations": [
    { "start_time": 120.0, "end_time": 135.0, "text": "First strategy is influencer...", "source": "audio" },
    { "start_time": 210.0, "end_time": 225.0, "text": "Second, we use retargeting...", "source": "audio" },
    { "start_time": 310.0, "end_time": 325.0, "text": "Third, podcast sponsorships...", "source": "audio" }
  ],
  "agent_trace": {
    "retriever": { "chunks_fetched": 8, "latency_ms": 120 },
    "analyzer": { "relevant_chunks": 5, "latency_ms": 450 },
    "synthesizer": { "tokens_used": 1200, "latency_ms": 800 },
    "citation_linker": { "citations_matched": 3, "latency_ms": 60 }
  },
  "conversation_id": "conv-uuid"
}
```

**How It Connects to MS3:**
- Calls `GET /video/{video_id}/context?query={question}&limit=10`
- Receives `context_blocks[]` → feeds to the agent pipeline

---

### 3.3 `POST /api/v1/search-chat` — Cross-Library Search Chat

User asks a question that spans their **entire** video library. MS6 searches globally, then synthesizes.

**Request:**

```json
{
  "user_id": "user-uuid",
  "question": "In which meetings did we discuss AWS Lambda?",
  "filters": {
    "language": "en"
  }
}
```

**Response:**

```json
{
  "answer": "AWS Lambda was discussed in two meetings: the Architecture Review on March 5th [1:20-1:45] where the team evaluated cold-start latency, and the Cost Optimization standup on March 12th [0:30-0:55] where serverless billing was compared to ECS.",
  "citations": [
    { "video_id": "uuid-1", "title": "Architecture Review", "start_time": 80.0, "end_time": 105.0, "text": "...", "source": "audio" },
    { "video_id": "uuid-2", "title": "Cost Optimization", "start_time": 30.0, "end_time": 55.0, "text": "...", "source": "audio" }
  ],
  "videos_referenced": 2,
  "agent_trace": { "..." : "..." }
}
```

**How It Connects to MS3:**
- Calls `GET /search?query={question}&language=en&limit=15`
- Receives `SearchResult[]` → feeds to agent pipeline

---

### 3.4 `POST /api/v1/summarize` — Full Video Summarization

Generates an executive summary with chapter breakdown.

**Request:**

```json
{
  "video_id": "uuid",
  "user_id": "user-uuid",
  "style": "executive"
}
```

**Response:**

```json
{
  "video_id": "uuid",
  "title": "Q3 Planning Session",
  "summary": "This 45-minute planning session covered three main topics...",
  "chapters": [
    { "title": "Opening & Agenda", "start_time": 0.0, "end_time": 120.0, "summary": "The host outlined..." },
    { "title": "Marketing Strategy", "start_time": 120.0, "end_time": 600.0, "summary": "Three campaigns were proposed..." },
    { "title": "Budget Allocation", "start_time": 600.0, "end_time": 900.0, "summary": "Finance approved a..." }
  ],
  "agent_trace": {
    "retriever": { "total_chunks": 85 },
    "chunker": { "segments_created": 6 },
    "map_summarizer": { "summaries_generated": 6, "latency_ms": 3200 },
    "reduce_synthesizer": { "latency_ms": 1100 }
  }
}
```

**How It Connects to MS3:**
- Calls `GET /video/{video_id}/chunks` to get the **full** ordered transcript
- Splits into windows → Map-Reduce agent pipeline

---

### 3.5 `POST /api/v1/research` — Deep Agentic Research

The most advanced endpoint. An autonomous research loop that iteratively queries MS3, reasons about what's missing, refines its search, and finally synthesizes a comprehensive research report.

**Request:**

```json
{
  "user_id": "user-uuid",
  "topic": "Compare all discussions about cloud migration versus on-premise solutions",
  "video_ids": ["uuid-1", "uuid-2", "uuid-3"],
  "max_iterations": 5
}
```

**Response:**

```json
{
  "report": "## Cloud Migration vs On-Premise: Cross-Video Analysis\n\n### Key Findings\n...",
  "sources_used": 23,
  "videos_analyzed": 3,
  "iterations_taken": 3,
  "agent_trace": {
    "planner": { "sub_queries_generated": 4 },
    "retriever_loop": [
      { "iteration": 1, "query": "cloud migration benefits", "chunks_found": 8 },
      { "iteration": 2, "query": "on-premise advantages cost", "chunks_found": 6 },
      { "iteration": 3, "query": "migration risks security", "chunks_found": 5 }
    ],
    "synthesizer": { "tokens_used": 4500, "latency_ms": 2800 }
  }
}
```

**How It Connects to MS3:**
- **Iteration 1:** Agent calls `GET /search?query=cloud+migration&video_id=...&limit=10`
- **Iteration 2:** Agent generates a follow-up query → calls `GET /search?query=on-premise+cost&limit=10`
- **Iteration N:** Continues until confidence threshold is met or `max_iterations` is reached
- Final synthesis merges all accumulated chunks

---

## 4. Multi-Agent Architecture

MS6 internally uses a pipeline of specialized "agents" — each agent is a **single focused Gemini API call** with a tailored system prompt. They are not autonomous agents in the traditional sense; they are **chained LLM invocations** where each step's output becomes the next step's input.

### 4.1 Agent Roster

```
┌─────────────────────────────────────────────────────────┐
│                     MS6 — The Brain                     │
│                                                         │
│  ┌───────────┐   ┌────────────┐   ┌──────────────────┐  │
│  │ RETRIEVER │──▶│  ANALYZER  │──▶│   SYNTHESIZER    │  │
│  │   Agent   │   │   Agent    │   │     Agent        │  │
│  └───────────┘   └────────────┘   └──────────────────┘  │
│       │                                     │           │
│       │                          ┌──────────▼────────┐  │
│       │                          │  CITATION LINKER  │  │
│       ▼                          │      Agent        │  │
│   ┌────────┐                     └───────────────────┘  │
│   │  MS3   │                                            │
│   │ (HTTP) │                                            │
│   └────────┘                                            │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Agent Definitions

#### Agent 1: Retriever Agent

- **Purpose:** Fetch raw chunks from MS3 and optionally generate embedding queries.
- **NOT an LLM call.** This is a pure HTTP service call to MS3.
- **Input:** User question, video_id (optional), filters.
- **Output:** `List<SearchResult>` or `List<String>` context blocks from MS3.
- **MS3 endpoints used:**
  - `GET /search` (for cross-library)
  - `GET /video/{video_id}/context` (for single-video)
  - `GET /video/{video_id}/chunks` (for summarization)

#### Agent 2: Analyzer Agent (Gemini Call #1)

- **Purpose:** Read the raw retrieved chunks and determine which ones are **actually relevant** to the user's question. Filters noise, re-ranks by true semantic relevance, and extracts key facts.
- **System Prompt Pattern:**
  ```
  You are a video transcript analyst. Given a user question and a set of
  transcript chunks with timestamps, identify which chunks are directly
  relevant. For each relevant chunk, extract the key fact. Discard noise.
  Return a JSON array of relevant facts with their timestamps.
  ```
- **Input:** User question + raw chunks from Retriever.
- **Output:** Filtered list of `{ fact, start_time, end_time, source_text }`.
- **Why this exists:** MS3's vector search returns the *closest* chunks, but not all of them are truly relevant to the nuanced question. This agent acts as a semantic filter and fact extractor.

#### Agent 3: Synthesizer Agent (Gemini Call #2)

- **Purpose:** Take the analyzed facts and compose a natural, fluent, conversational answer. This is where the "human feel" is generated.
- **System Prompt Pattern:**
  ```
  You are a conversational video research assistant. Using the following
  verified facts extracted from video transcripts, write a clear, well-
  structured answer to the user's question. Reference timestamps in
  [MM:SS] format. If conversation history is provided, maintain context.
  Do not hallucinate information not present in the facts.
  ```
- **Input:** Analyzed facts from Agent 2 + conversation history (if multi-turn).
- **Output:** The final prose answer string.
- **Why this exists:** Separating analysis from synthesis ensures the LLM doesn't skip facts or hallucinate new ones. The Synthesizer only works with pre-verified data.

#### Agent 4: Citation Linker Agent (Gemini Call #3)

- **Purpose:** Parse the synthesized answer and match every factual claim back to a specific transcript chunk with precise timestamp ranges. Produces the structured `citations[]` array.
- **System Prompt Pattern:**
  ```
  You are a citation engine. Given an answer text and a list of source
  transcript chunks, produce a JSON array mapping each factual claim
  in the answer to the specific chunk it came from, including video_id,
  start_time, end_time, and the original source text.
  ```
- **Input:** Synthesized answer + original chunk list.
- **Output:** `List<Citation>` with `{ start_time, end_time, text, video_id }`.
- **Why this exists:** Provides verifiable, clickable timestamp links in the frontend so the user can jump to the exact moment in the video.

### 4.3 Specialized Pipelines

Different endpoints use different agent combinations:

| Endpoint | Retriever | Analyzer | Synthesizer | Citation Linker | Notes |
|---|:---:|:---:|:---:|:---:|---|
| `/chat` | ✅ | ✅ | ✅ | ✅ | Full 4-agent pipeline |
| `/search-chat` | ✅ | ✅ | ✅ | ✅ | Same pipeline, but Retriever hits global `/search` |
| `/summarize` | ✅ | — | ✅ (Map) | — | Uses Map-Reduce variant (see §4.4) |
| `/research` | ✅ (loop) | ✅ | ✅ | ✅ | Adds Planner + iterative Retriever loop |

### 4.4 Map-Reduce Summarization Pipeline

For `/summarize`, the full transcript can be **thousands of tokens**. MS6 uses a Map-Reduce strategy:

```
Full Chunks (from MS3 GET /chunks)
        │
        ▼
  ┌──────────────┐
  │   CHUNKER    │  Splits transcript into ~5 min windows
  └──────┬───────┘
         │
    ┌────┼────┬────┐
    ▼    ▼    ▼    ▼
  ┌───┐┌───┐┌───┐┌───┐
  │MAP││MAP││MAP││MAP│   ← Parallel Gemini calls (one per window)
  └─┬─┘└─┬─┘└─┬─┘└─┬─┘     "Summarize this 5-min segment"
    │    │    │    │
    └────┼────┴────┘
         ▼
   ┌───────────┐
   │  REDUCER   │  Single Gemini call combining all segment summaries
   └─────┬─────┘   "Write a cohesive executive summary with chapters"
         │
         ▼
   Final Summary + Chapters
```

### 4.5 Research Loop (Agentic Iteration)

For `/research`, MS6 spawns a **Planner Agent** that generates sub-queries, then loops:

```
User Topic
    │
    ▼
┌──────────┐
│ PLANNER  │  Gemini call: "Break this research topic into 3-4 sub-questions"
└────┬─────┘
     │  sub_queries = ["cloud migration benefits", "on-prem costs", ...]
     ▼
┌──────────────────────────────────────────────────────────────┐
│  RETRIEVAL LOOP (max N iterations)                          │
│                                                              │
│  for each sub_query:                                         │
│    1. Retriever → GET /search?query={sub_query}&limit=10     │
│    2. Analyzer  → filter relevant chunks                     │
│    3. Accumulate facts into shared context                   │
│                                                              │
│  After each iteration:                                       │
│    CONFIDENCE CHECK (Gemini call):                           │
│    "Do you have enough facts to answer the user topic?"      │
│    → if yes, break                                           │
│    → if no, generate refined sub-query, continue             │
└──────────────────────────────────────────────────────────────┘
     │
     ▼
┌───────────────┐
│  SYNTHESIZER  │  "Write a research report from these accumulated facts"
└───────┬───────┘
        │
        ▼
┌────────────────┐
│ CITATION LINKER│  Map claims → source chunks
└────────────────┘
        │
        ▼
  Final Research Report
```

---

## 5. Configuration

**`application.properties` / `application.yml`:**

```yaml
# ── Server ──────────────────────────────────────────────
server.port=8086
spring.application.name=neurostream-ms6

# ── MS3 Connection ──────────────────────────────────────
ms3.base-url=http://localhost:8003
ms3.search-default-limit=10
ms3.context-default-limit=10
ms3.connect-timeout-ms=5000
ms3.read-timeout-ms=15000

# ── Gemini API ──────────────────────────────────────────
gemini.api-key=${GEMINI_API_KEY}
gemini.model=gemini-2.5-flash
gemini.embedding-model=text-embedding-004
gemini.max-output-tokens=4096
gemini.temperature=0.3

# ── Agent Tuning ────────────────────────────────────────
agent.analyzer.temperature=0.1
agent.synthesizer.temperature=0.5
agent.citation-linker.temperature=0.0
agent.planner.temperature=0.3
agent.research.max-iterations=5
agent.research.confidence-threshold=0.8

# ── Summarization ──────────────────────────────────────
summarize.window-duration-seconds=300
summarize.map-parallelism=4

# ── Logging / Observability ─────────────────────────────
logging.level.com.example.MS6=DEBUG
management.endpoints.web.exposure.include=health,info,metrics
```

---

## 6. Spring Boot Package Structure

```
com.example.MS6
├── Ms6Application.java                    ← Entry point (exists)
│
├── config/
│   ├── Ms3ClientConfig.java               ← WebClient bean for MS3
│   ├── GeminiClientConfig.java            ← WebClient bean for Gemini API
│   └── AgentProperties.java               ← @ConfigurationProperties for agent tuning
│
├── controller/
│   ├── HealthController.java              ← GET /health
│   ├── ChatController.java                ← POST /api/v1/chat, /api/v1/search-chat
│   ├── SummarizeController.java           ← POST /api/v1/summarize
│   └── ResearchController.java            ← POST /api/v1/research
│
├── dto/
│   ├── request/
│   │   ├── ChatRequest.java               ← { video_id, user_id, question, history }
│   │   ├── SearchChatRequest.java         ← { user_id, question, filters }
│   │   ├── SummarizeRequest.java          ← { video_id, user_id, style }
│   │   └── ResearchRequest.java           ← { user_id, topic, video_ids, max_iterations }
│   │
│   ├── response/
│   │   ├── ChatResponse.java              ← { answer, citations[], agent_trace }
│   │   ├── SummarizeResponse.java         ← { summary, chapters[], agent_trace }
│   │   └── ResearchResponse.java          ← { report, sources_used, agent_trace }
│   │
│   └── ms3/                               ← DTOs mirroring MS3's response schemas
│       ├── SearchResult.java              ← Maps MS3 SearchResult JSON
│       ├── SearchResponse.java            ← { results[], total, storage_backend }
│       ├── ContextResponse.java           ← { video_id, context_blocks[], storage_backend }
│       ├── ChunkResponse.java             ← { id, video_id, chunk_index, start_time, ... }
│       └── VideoStatusResponse.java       ← { video_id, status, indexed_at }
│
├── client/
│   ├── Ms3Client.java                     ← HTTP calls to MS3 endpoints
│   └── GeminiClient.java                  ← HTTP calls to Gemini REST API
│
├── agent/
│   ├── Agent.java                         ← Base interface: execute(input) → output
│   ├── RetrieverAgent.java                ← Pure HTTP: calls Ms3Client
│   ├── AnalyzerAgent.java                 ← Gemini call #1: chunk relevance filtering
│   ├── SynthesizerAgent.java              ← Gemini call #2: answer composition
│   ├── CitationLinkerAgent.java           ← Gemini call #3: timestamp citation mapping
│   ├── PlannerAgent.java                  ← Gemini call: decompose topic into sub-queries
│   ├── MapSummarizerAgent.java            ← Gemini call: summarize one transcript window
│   └── ReduceSummarizerAgent.java         ← Gemini call: merge segment summaries
│
├── pipeline/
│   ├── ChatPipeline.java                  ← Orchestrates: Retriever → Analyzer → Synthesizer → CitationLinker
│   ├── SummarizePipeline.java             ← Orchestrates: Retriever → Chunker → MapReduce
│   └── ResearchPipeline.java              ← Orchestrates: Planner → iterative Retriever+Analyzer → Synthesizer
│
└── service/
    ├── ChatService.java                   ← Business logic for /chat and /search-chat
    ├── SummarizeService.java              ← Business logic for /summarize
    └── ResearchService.java               ← Business logic for /research
```

---

## 7. Data Flow Diagrams

### 7.1 `/api/v1/chat` — Full Pipeline

```
Frontend
   │
   │  POST /api/v1/chat { video_id, question }
   ▼
MS6 ChatController
   │
   ▼
ChatService
   │
   ├──▶ RetrieverAgent
   │       │
   │       │  GET http://ms3:8003/video/{id}/context?query=...&limit=10
   │       ▼
   │      MS3 returns ContextResponse { context_blocks[] }
   │
   ├──▶ AnalyzerAgent (Gemini Call)
   │       Input:  question + context_blocks
   │       Output: filtered_facts[]
   │
   ├──▶ SynthesizerAgent (Gemini Call)
   │       Input:  question + filtered_facts + conversation_history
   │       Output: answer_text
   │
   └──▶ CitationLinkerAgent (Gemini Call)
           Input:  answer_text + original chunks
           Output: citations[]
   │
   ▼
ChatResponse { answer, citations, agent_trace }
```

### 7.2 `/api/v1/research` — Iterative Loop

```
Frontend
   │
   │  POST /api/v1/research { topic, video_ids }
   ▼
MS6 ResearchController
   │
   ▼
ResearchService
   │
   ├──▶ PlannerAgent (Gemini Call)
   │       Input:  topic
   │       Output: sub_queries = ["q1", "q2", "q3"]
   │
   ├──▶ for each sub_query (up to max_iterations):
   │       │
   │       ├── RetrieverAgent → GET /search?query={sub_query}&limit=10
   │       ├── AnalyzerAgent  → filter & extract facts
   │       ├── Accumulate into fact_pool
   │       │
   │       └── ConfidenceCheck (Gemini Call):
   │            "Given {fact_pool}, can you fully answer {topic}?"
   │            → yes: break loop
   │            → no:  generate refined query, continue
   │
   ├──▶ SynthesizerAgent (Gemini Call)
   │       Input:  fact_pool + topic
   │       Output: research_report (markdown)
   │
   └──▶ CitationLinkerAgent (Gemini Call)
           Input:  report + all retrieved chunks
           Output: citations[]
   │
   ▼
ResearchResponse { report, sources_used, iterations_taken, agent_trace }
```

---

## 8. Gemini API Integration

MS6 calls Gemini via its **REST API** (not a Java SDK), using Spring's `WebClient`.

### 8.1 Request Format

```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={API_KEY}
```

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [{ "text": "system prompt + user content" }]
    }
  ],
  "generationConfig": {
    "temperature": 0.3,
    "maxOutputTokens": 4096,
    "responseMimeType": "application/json"
  }
}
```

### 8.2 Key Design Decision: JSON Mode

All agent calls use `responseMimeType: "application/json"` so the Gemini output is always parseable. Each agent's system prompt includes a JSON schema specification for its expected output. This eliminates brittle regex parsing.

---

## 9. Error Handling & Resilience

| Failure | Strategy |
|---|---|
| MS3 unreachable | Return `503` with `"MS3 is unavailable. Video search is temporarily offline."` |
| MS3 returns 0 chunks | Skip Analyzer/Synthesizer, return `"No indexed content found for this video."` |
| Gemini API rate limit | Retry with exponential backoff (max 3 retries, 1s → 2s → 4s) |
| Gemini returns malformed JSON | Retry once with stricter prompt; if still fails, return raw text with warning |
| Video not indexed (`status != ready`) | Return `400` with `"This video is still being processed."` — check via `GET /video/{id}/status` |
| Research loop exceeds max iterations | Force-synthesize with whatever facts are accumulated so far |

---

## 10. Observability

Every response includes an `agent_trace` object that logs:
- Which agents ran
- How many chunks each agent processed
- Latency in milliseconds per agent
- Token usage per Gemini call
- Number of MS3 HTTP calls made

This is critical for debugging, cost tracking, and performance tuning.

---

## 11. Future Considerations (Out of Scope for V1)

- **Streaming responses** via SSE for real-time token delivery to the frontend
- **Conversation persistence** in Redis or PostgreSQL for multi-turn memory
- **MS5 integration** to bias retrieval toward user's frequently visited segments
- **Embedding generation** inside MS6 via Gemini's embedding model to avoid depending on pre-computed vectors
- **Caching layer** for repeated questions on the same video
- **WebSocket support** for long-running research tasks with progress updates
