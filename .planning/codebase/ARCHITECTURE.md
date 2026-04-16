# Architecture — AIRA

AIRA is a local RAG (retrieval-augmented generation) chat application. Users upload documents, and a local LLM answers questions grounded in the uploaded corpus with inline citations. All inference runs locally via Ollama; no external APIs.

---

## Pattern

**Layered service architecture** (FastAPI convention):

```
API layer         → thin HTTP/SSE handlers, validation, rate limits
Service layer     → orchestration + domain logic (chunking, embedding, retrieval, RAG)
Integration layer → Ollama client, ChromaDB client, SQLAlchemy, filesystem
Storage           → ChromaDB (vectors), SQLite (sessions), filesystem (uploads)
```

Frontend: React 19 SPA consuming JSON + SSE endpoints.

---

## Backend entry point

- `backend/main.py` — FastAPI app construction, CORS, lifespan hooks, routers mounted:
  - `/api/documents` → `backend/api/documents.py`
  - `/api/chat` → `backend/api/chat.py`
  - `/api/search` → `backend/api/search.py`

App instantiates shared clients at startup: Ollama client, ChromaDB persistent client, SQLAlchemy engine.

---

## Two principal data flows

### A. Ingestion pipeline (synchronous, inside HTTP request)

```
Client (FileUpload.tsx)
   │ multipart/form-data POST /api/documents/upload
   ▼
api/documents.py
   │  1. FileValidator  (services/file_validator.py)
   │     — extension + magic-byte check, size cap
   │  2. TextExtractor  (services/text_extractor.py)
   │     — PyMuPDF for PDF, raw read for TXT/MD
   │  3. Persist extracted text → uploads/text/{doc_id}.txt
   │  4. ChunkingService (services/chunking_service.py)
   │     — RecursiveCharacterTextSplitter, chunk=512, overlap=51
   │  5. EmbeddingService (services/embedding_service.py)
   │     — ollama.embed(model="nomic-embed-text") per chunk
   │  6. VectorService   (services/vector_service.py)
   │     — Chroma collection.add(embeddings, metadata, ids)
   │  7. DocumentService (services/document_service.py)
   │     — append entry to uploads/metadata.json (asyncio.Lock guarded)
   ▼
HTTP 200 { doc_id, chunks, ... }
```

All 7 steps run inside the request. Long PDFs block the client for 10-30s+.

### B. Query / RAG pipeline (streaming)

```
Client (Chat.tsx) — POST /api/chat  { message, session_id, doc_ids?, top_k }
   │
   ▼
api/chat.py
   │  1. SessionService  (services/session_service.py)
   │     — load-or-create Session in sessions.db; append user message
   │  2. RAGService      (services/rag_service.py) — orchestrates:
   │        a. RetrievalService.search(query, doc_ids, top_k)
   │               → EmbeddingService.embed(query)
   │               → vector_service.query_cosine(top_k, where=doc_id filter)
   │               → returns [{chunk_text, doc_id, filename, score, ...}]
   │        b. Build grounded prompt with [Doc N] citations + history
   │        c. OllamaClient.chat_stream(model, messages)
   │  3. Stream tokens back as Server-Sent Events
   │  4. On completion, append assistant message to session
   ▼
SSE: event: token / event: sources / event: done
```

Retrieval is **pure dense cosine** (no rerank, no hybrid, no query rewrite). Top-k default 5, cap 20.

---

## Core abstractions

| Abstraction | File | Responsibility |
|---|---|---|
| `OllamaClient` | `backend/ollama_client.py` | Sync + async wrappers for `embed()` and `chat()`; streaming generator for chat |
| `FileValidator` | `backend/services/file_validator.py` | Extension/magic-byte check, size cap |
| `TextExtractor` | `backend/services/text_extractor.py` | PyMuPDF PDF → text; raw read for TXT/MD |
| `ChunkingService` | `backend/services/chunking_service.py` | LangChain `RecursiveCharacterTextSplitter`, fixed 512/51 |
| `EmbeddingService` | `backend/services/embedding_service.py` | `nomic-embed-text` embeddings, per-chunk loop |
| `VectorService` | `backend/services/vector_service.py` | ChromaDB persistent collection (cosine HNSW) |
| `RetrievalService` | `backend/services/retrieval_service.py` | Query embed → chroma.query → relevance scoring `1/(1+dist)` |
| `RAGService` | `backend/services/rag_service.py` | Orchestrates retrieval + prompt construction + streaming |
| `SessionService` | `backend/services/session_service.py` | SQLAlchemy session/message persistence |
| `DocumentService` | `backend/services/document_service.py` | JSON metadata store for uploaded documents |

---

## Storage topology

```
backend/
  sessions.db                 SQLite (SQLAlchemy) — chat sessions + messages
  uploads/
    metadata.json             JSON index of documents (asyncio.Lock serialized)
    text/{doc_id}.txt         Extracted plain text (audit/reprocess)
    vectors/                  ChromaDB PersistentClient directory
      chroma.sqlite3
      {collection-uuid}/...
```

Document identity: UUID4 per upload (`doc_id`). Chunks carry metadata `{doc_id, filename, chunk_index, total_chunks}`.

---

## API surface

| Method | Path | Purpose | Rate limit (SlowAPI) |
|---|---|---|---|
| POST | `/api/documents/upload` | Upload + index a document | 20/min |
| GET | `/api/documents` | List documents | 120/min |
| DELETE | `/api/documents/{doc_id}` | Remove document + vectors | 20/min |
| POST | `/api/chat` | Streaming RAG chat (SSE) | 60/min |
| GET | `/api/chat/sessions` | List sessions | 120/min |
| GET | `/api/chat/sessions/{sid}` | Get session + messages | 120/min |
| DELETE | `/api/chat/sessions/{sid}` | Delete session | 60/min |
| POST | `/api/search` | Standalone vector search (no generation) | 60/min |
| GET | `/api/models` | List available Ollama models | 120/min |
| GET | `/health` | Health check | — |

CORS configured for `http://localhost:5173` (Vite dev server) by default.

---

## Frontend ↔ backend wiring

- `frontend/src/services/api.ts` — single fetch-based client; centralizes base URL + JSON handling
- SSE parsed manually in `frontend/src/components/Chat.tsx` via `Response.body.getReader()`
- Sessions tracked client-side in `useChatSessions` (localStorage + fetch); backend is source of truth for messages
- Documents fetched via `DocumentList.tsx`, selected set passed to chat for scoped retrieval

---

## What's NOT in the architecture today

These absences matter for the roadmap:

- **No background job queue** — ingestion is inline
- **No reranker** — retrieval returns raw top-k
- **No BM25 / hybrid index** — dense-only
- **No query rewriter** — user query embedded verbatim
- **No migration system** (Alembic absent)
- **No backend tests** — frontend has Vitest, backend has none
- **No observability layer** — minimal stdlib logging, no metrics
