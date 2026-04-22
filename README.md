# AIRA -- AI Research Assistant

AIRA is a local-first RAG chat application. Upload PDFs and text files, ask questions in natural language, and get answers grounded in your documents with inline citations. All inference runs on your machine via [Ollama](https://ollama.ai) -- no external APIs, no cloud calls.

## Project structure

| Directory   | Stack              | Role |
|------------|--------------------|------|
| `frontend/` | React 19, TypeScript, Vite, Tailwind | Document management, model selector, chat UI |
| `backend/`  | FastAPI, SQLite, ChromaDB | API, document processing, retrieval pipeline, chat sessions |

## Features

- **Document management** -- Upload, list, and delete documents (PDF, `.txt`, `.md`). Text is extracted, chunked, embedded, and stored for semantic search.
- **Semantic chunking** -- Documents are split along heading and paragraph boundaries with parent-child mapping. Small child chunks (~300 tokens) are embedded for precision; larger parent chunks (~1000 tokens) are returned to the LLM for context.
- **Hybrid search** -- Queries run against both dense embeddings (bge-m3, 1024-dim) and a BM25 keyword index, fused via Reciprocal Rank Fusion.
- **Cross-encoder reranking** -- Top candidates are reranked by bge-reranker-v2-m3 for relevance. Falls back to fusion-only results if the reranker exceeds its timeout.
- **Query rewriting** -- Conversational follow-ups ("what about the second one?") are rewritten into standalone queries using session history. Abstract queries generate a hypothetical answer (HyDE) for better embedding similarity. A confidence gate falls back to the original query if a rewrite drifts off-topic.
- **Contextual retrieval** (opt-in) -- At ingest time, each chunk can be prepended with an LLM-generated context summary describing where it sits in the source document. Includes anti-hallucination validation.
- **Chat** -- Multi-turn chat with streaming responses. Sessions are stored in SQLite and can be resumed; history is persisted in the browser.
- **Model selection** -- Pick which Ollama model to use for chat from the UI or via the API.
- **Multilingual** -- bge-m3 embeddings and bge-reranker-v2-m3 support 100+ languages.

## Prerequisites

- **Node.js** 18+
- **Python** 3.9+
- **Ollama** -- [Install](https://ollama.ai)
- **npm** (or yarn/pnpm)

## Quick start

### 1. Ollama

Install Ollama and pull the required models:

```bash
ollama pull qwen3:8b       # chat model (or any model you prefer)
ollama pull bge-m3          # embedding model
```

The cross-encoder reranker (bge-reranker-v2-m3) is downloaded automatically on first query via FlagEmbedding.

### 2. Backend

From the project root:

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API: `http://localhost:8000`

> **Note:** On first startup, the app validates that ChromaDB embedding dimensions match the configured model (bge-m3, 1024-dim). If you have old vectors from a previous embedding model, delete `backend/uploads/vectors/` and re-upload your documents.

### 3. Frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:5173`. The dev server proxies `/api` to the backend.

## API overview

When the backend is running, interactive docs: **http://localhost:8000/docs**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with component status (reranker, BM25) |
| `/api/ollama/status` | GET | Ollama connection and model list |
| `/api/models` | GET | List available Ollama models |
| `/api/model/select` | POST | Set the model used for chat (body: `{"model_name": "qwen3:8b"}`) |
| `/api/documents` | GET | List uploaded documents |
| `/api/documents/upload` | POST | Upload a document (PDF, .txt, .md) |
| `/api/documents/{id}` | DELETE | Delete a document and its vectors |
| `/api/search` | GET | Semantic search (`q`, `top_k`, optional `doc_ids`) |
| `/api/chat/session/new` | POST | Create a chat session |
| `/api/chat/session/{id}` | GET / DELETE | Get or delete a session |
| `/api/chat/message` | POST | Send a message (streaming SSE response) |

## How it works

### Ingestion

Upload a file and the backend extracts text, splits it into semantic chunks (heading-aware with parent-child mapping), generates bge-m3 embeddings via Ollama, and stores them in ChromaDB. A BM25 keyword index is built in parallel. Optionally, each chunk can be enriched with an LLM-generated context summary (set `CONTEXTUAL_RETRIEVAL_ENABLED = True` in `backend/config.py`).

### Retrieval

A query goes through classification (standalone, follow-up, or abstract). Follow-ups are rewritten into standalone queries using session history. Abstract queries generate a hypothetical passage (HyDE) and embed that instead. The query then hits both dense (bge-m3) and BM25 indexes, results are fused via RRF, reranked by a cross-encoder, and parent chunks are expanded before being sent to the LLM.

### Chat

The retrieved context plus conversation history is sent to the selected Ollama model. The reply is streamed back via SSE with inline citations. Sessions and messages are stored in SQLite.

## Configuration

Retrieval pipeline settings are in `backend/config.py`. Key options:

| Setting | Default | Description |
|---------|---------|-------------|
| `EMBEDDING_MODEL` | `bge-m3` | Ollama embedding model |
| `RERANKER_TIMEOUT_MS` | `200` | Cross-encoder timeout before fallback |
| `QUERY_REWRITING_ENABLED` | `True` | Enable conversational query rewriting |
| `CONTEXTUAL_RETRIEVAL_ENABLED` | `False` | Enable LLM context summaries at ingest time |
| `CONFIDENCE_GATE_THRESHOLD` | `0.4` | Cosine similarity floor for rewrite acceptance |
| `PARENT_CHUNK_SIZE` | `1000` | Parent chunk size in tokens |
| `CHILD_CHUNK_SIZE` | `300` | Child chunk size in tokens |

See `backend/config.py` for the full list.

## Development

- **Backend:** `uvicorn main:app --reload` (run from `backend/`).
- **Frontend:** `npm run dev` (run from `frontend/`).
- **Tests:** `cd backend && python -m pytest tests/ -v`

Both support hot reload.

## Production build (frontend)

```bash
cd frontend
npm run build
```

Output is in `frontend/dist/`. Serve it with any static host; ensure requests to `/api` are proxied to the FastAPI backend.

## License

MIT
