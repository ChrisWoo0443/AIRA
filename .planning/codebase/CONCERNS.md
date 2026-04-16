# Concerns — AIRA Codebase

Technical debt, known issues, and weak spots. Grouped by category. Severity: HIGH / MEDIUM / LOW.

---

## 1. RAG Accuracy & Quality

### 1.1 Fixed 512-char chunks — suboptimal for dense text (HIGH)
- **Location:** `backend/services/chunking_service.py:26-28`
- **Why it matters:** 512 chars ≈ 100-130 tokens. Technical concepts routinely span 2-3 chunks, breaking semantic boundaries and degrading retrieval precision. 10% overlap (51 chars) is too thin to preserve context at chunk boundaries.
- **Fix direction:** Move to token-based chunks (~800-1000 tokens), 15-25% overlap, heading-/paragraph-aware splits; consider parent-document retrieval (embed small, return parent).

### 1.2 No query rewriting or expansion (MEDIUM)
- **Location:** `backend/services/retrieval_service.py:32-46`
- **Why it matters:** Conversational follow-ups ("what about the second one?"), multi-part questions, and spelling/terminology variants all embed poorly as-is.
- **Fix direction:** LLM-based query rewrite with session history, HyDE for abstract questions, optional decomposition for multi-hop.

### 1.3 No reranking, no relevance threshold (MEDIUM — highest accuracy ROI)
- **Location:** `backend/services/retrieval_service.py:51-93`
- **Why it matters:** Top-k cosine returns noisy middle results; LLM grounds on weak chunks. No minimum-similarity cutoff means irrelevant chunks still injected.
- **Fix direction:** Retrieve top 20-30, cross-encoder rerank (`bge-reranker-v2-m3`), drop below threshold, MMR for diversity.

### 1.4 No hybrid search (BM25 + dense) (MEDIUM)
- **Location:** `backend/services/retrieval_service.py:12-95`
- **Why it matters:** Pure dense embeddings miss exact phrases, proper nouns, acronyms, numeric codes.
- **Fix direction:** Add BM25 index (`rank_bm25`), fuse via RRF.

### 1.5 Flat metadata filtering (doc_id only) (LOW)
- **Location:** `backend/services/retrieval_service.py:40-45`
- **Why it matters:** Can't filter by date, doc type, section, tags.
- **Fix direction:** Extend chunk metadata (type, section, date, tags) + expose filter API.

---

## 2. Performance & Scalability

### 2.1 Synchronous embedding inside upload request (HIGH)
- **Location:** `backend/api/documents.py:99-109`
- **Why it matters:** 10MB PDF → 10-30+s client hang. Blocks the event loop for concurrent users.
- **Fix direction:** Background task queue (FastAPI `BackgroundTasks` for MVP, Celery/RQ for production). Status endpoint + polling.

### 2.2 No batching for embedding calls (MEDIUM)
- **Location:** `backend/services/embedding_service.py:10-48`
- **Why it matters:** One Ollama call per chunk; Ollama supports batched embeddings.
- **Fix direction:** Batch 50-100 chunks per call.

### 2.3 No vector versioning / re-embed path (MEDIUM)
- **Location:** `backend/services/vector_service.py:47-88`
- **Why it matters:** Upgrading embedding model requires manually wiping ChromaDB.
- **Fix direction:** Store `embedding_model` + `embedding_version` in metadata; add admin reindex endpoint.

### 2.4 Unbounded conversation history (MEDIUM)
- **Location:** `backend/models/session.py:39`, `backend/api/chat.py:174-177`
- **Why it matters:** Every turn resends full history to LLM; cost and latency grow unboundedly; eventually exceeds context window.
- **Fix direction:** Sliding window (last N turns), summarization of older turns, session TTL.

---

## 3. Data & Storage Fragility

### 3.1 JSON metadata store — no ACID (HIGH)
- **Location:** `backend/services/document_service.py:22-38`
- **Why it matters:** Single `uploads/metadata.json` protected only by `asyncio.Lock`. Crash mid-write = corrupt file. No cross-process safety.
- **Fix direction:** Move to SQLite (already have sessions.db). Use SQLAlchemy; add migrations.

### 3.2 No migration system (MEDIUM)
- **Location:** Backend-wide; no Alembic
- **Why it matters:** Any schema change = manual intervention.
- **Fix direction:** Add Alembic, initial revision, auto-run on startup in dev.

### 3.3 ChromaDB has no backup strategy (MEDIUM)
- **Location:** `backend/services/vector_service.py:12-16`
- **Why it matters:** Disk failure = total vector loss.
- **Fix direction:** Scheduled snapshots of `uploads/vectors/`, documented restore.

---

## 4. Security

### 4.1 File-upload validation incomplete (MEDIUM)
- **Location:** `backend/services/file_validator.py:10-30`
- **Why it matters:** No PDF structure check, UTF-8 detection is permissive, no extraction size/time bound → DoS via crafted PDF.
- **Fix direction:** Validate PDF header/structure, add extraction timeout, cap extracted char count.

### 4.2 Rate limiting is IP-based only (LOW)
- **Location:** `backend/rate_limiter.py:10`
- **Why it matters:** Shared IPs / proxies bypass it; no per-session quotas.
- **Fix direction:** Session-based limits + sliding window.

### 4.3 Hardcoded config (LOW)
- **Location:** `backend/main.py`, `backend/models/session.py:18-20`
- **Why it matters:** Ollama host, DB path, CORS origins baked in.
- **Fix direction:** `pydantic-settings` / `.env`, env var overrides.

---

## 5. Observability

### 5.1 Minimal logging, silent except blocks (MEDIUM)
- **Location:** `backend/api/documents.py:25, 108, 155`
- **Why it matters:** Only 2-3 warning calls across the stack; exceptions swallowed without stack traces. Debugging production issues is blind.
- **Fix direction:** Structured logging (loguru / stdlib), log lifecycle events (upload → chunk → embed → store), always log stack traces.

### 5.2 No metrics (LOW)
- **Location:** Backend-wide
- **Why it matters:** Can't measure embedding latency, Ollama error rate, retrieval distribution.
- **Fix direction:** Prometheus `/metrics` endpoint, histograms for latencies, counters for operations.

---

## 6. Tech Debt

### 6.1 Zero backend tests (HIGH)
- **Location:** Entire `backend/`; no `__tests__/` or `tests/` folder
- **Why it matters:** Can't safely refactor the RAG pipeline — the exact area the user wants to improve. Every upgrade becomes a regression risk.
- **Fix direction:** pytest + pytest-asyncio; start with `retrieval_service` and `rag_service` integration tests before any RAG refactor.

### 6.2 Tight coupling in upload handler (MEDIUM)
- **Location:** `backend/api/documents.py:99-104`
- **Why it matters:** Handler directly orchestrates chunking → embedding → vector store, making async/queue migration painful.
- **Fix direction:** Extract `DocumentIndexingService`; inject services; handler only enqueues.

### 6.3 Inconsistent error handling (MEDIUM)
- **Location:** Across services
- **Why it matters:** Some functions raise, some return empty, some log-and-continue — downstream callers can't rely on any contract.
- **Fix direction:** Custom exception hierarchy; fail-fast at service layer; convert to HTTP errors only at API layer.

### 6.4 Hardcoded model names (LOW)
- **Location:** `backend/services/embedding_service.py:26`, `backend/ollama_client.py:13`
- **Why it matters:** Can't swap `nomic-embed-text` → `bge-m3` without editing code.
- **Fix direction:** Env-driven model registry; track which model was used per vector.

### 6.5 Session ID ownership split (LOW)
- **Location:** `backend/api/chat.py:152-153`
- **Why it matters:** Frontend generates; backend auto-creates on miss. Inconsistent source of truth.
- **Fix direction:** Backend-authoritative; expose `/session/new`.

---

## 7. Missing Capabilities

### 7.1 No re-embed / reindex endpoint (MEDIUM)
- **Why it matters:** Locked into initial embedding model decision.
- **Fix direction:** Admin `/api/admin/reindex` that re-chunks + re-embeds with progress.

### 7.2 No document deduplication (LOW)
- **Why it matters:** Re-uploading same file duplicates chunks, biasing retrieval.
- **Fix direction:** Content SHA-256 check before indexing.

### 7.3 No document versioning (LOW)
- **Why it matters:** Can't track edits/replacements.
- **Fix direction:** Version field + UI surface.

---

## 8. Test Coverage Summary

| Area | Coverage |
|------|----------|
| Frontend components (`frontend/src/__tests__/`) | Partial — `ChatInput.test.tsx`, `MessageList.test.tsx` |
| Backend services | **None** |
| Backend API endpoints | **None** |
| Backend integration | **None** |

**Priority untested surfaces (blockers for RAG refactor):**
- `retrieval_service.search_documents()`
- `rag_service.generate_rag_response()`
- `chunking_service` splitter behavior
- `embedding_service` Ollama error paths
- `document_service` metadata atomicity

---

## Top-5 Fix Priority (for RAG accuracy goal)

1. **Add integration tests for `retrieval_service` + `rag_service`** — safety net before any RAG refactor. (6.1)
2. **Cross-encoder reranking + similarity threshold** — biggest single accuracy win. (1.3)
3. **Hybrid search (BM25 + dense, RRF fusion).** (1.4)
4. **Token-aware chunking with heading-/paragraph-awareness and 20% overlap.** (1.1)
5. **Query rewriting with session history.** (1.2)

Performance (2.1) and storage (3.1) should follow, but accuracy wins 1-5 don't require them.
