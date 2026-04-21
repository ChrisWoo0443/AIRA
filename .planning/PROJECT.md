# AIRA

## What This Is

AIRA is a local-first RAG chat application: users upload documents, ask questions, and a local LLM answers grounded in the corpus with inline citations. All inference runs on the user's machine via Ollama — no external APIs, no cloud calls. This milestone focuses on retrieval quality: making the system surface the right chunks for the right questions, especially on acronyms, conversational follow-ups, multi-document queries, and content where current 512-char chunking under-serves the LLM.

## Core Value

When a user asks a question over their uploaded documents, the retrieved chunks contain the answer the LLM needs to cite. Everything else — UI, sessions, ingestion ergonomics — is secondary to retrieval being right.

## Requirements

### Validated

<!-- Inferred from existing codebase (.planning/codebase/ARCHITECTURE.md, STACK.md). -->

- ✓ User can upload PDF/TXT/MD documents (extension + magic-byte validation, size cap) — existing
- ✓ Documents are chunked (512 char / 51 overlap) and embedded with `nomic-embed-text` via Ollama — existing
- ✓ Vectors persisted in ChromaDB (cosine HNSW) with `{doc_id, filename, chunk_index, total_chunks}` metadata — existing
- ✓ User can chat with streaming SSE responses, scoped to selected docs or all docs — existing
- ✓ Responses include inline `[Doc N]` citations with source list — existing
- ✓ Sessions persisted in SQLite (SQLAlchemy), full message history per session — existing
- ✓ Standalone vector search endpoint (no generation) for debugging — existing
- ✓ Rate limiting on all endpoints via SlowAPI — existing
- ✓ Frontend (React 19 + Vite + Tailwind 4) with file upload, doc list, session list, markdown rendering — existing
- ✓ Cross-encoder reranker (bge-reranker-v2-m3, lazy singleton, 200ms timeout with RRF fallback) — Phase 1
- ✓ Hybrid search (BM25 + dense via RRF fusion, persistent index, rebuild on delete) — Phase 1
- ✓ Embedding upgrade to bge-m3 (1024-dim, multilingual, config-driven, startup dimension validation) — Phase 2

- ✓ Semantic chunking (two-pass parent-child, tiktoken cl100k_base, heading-aware splitting, parent-doc retrieval) — Phase 3
- ✓ Contextual retrieval (config-gated LLM context summaries with anti-hallucination validation) — Phase 3
- ✓ Query rewriting with LLM classification, conversational rewriting, HyDE, and confidence gate — Phase 4

### Active

No active requirements remain for this milestone. All retrieval-quality improvements are validated.

### Out of Scope

- **Full eval harness with labeled query set + recall@k metrics** — vibe-check on representative queries is sufficient for this milestone; consider for a future quality milestone if results are ambiguous
- **English-only optimization** — must work multilingually, so we pick multilingual models (bge-m3, bge-reranker-v2-m3) even when English-only models would score higher on English benchmarks
- **Cloud-hosted models / external APIs** — local-first is non-negotiable; everything runs on the user's machine
- **Background ingestion job queue** — ingestion stays synchronous in-request; the new techniques (Contextual Retrieval) make ingestion slower but we accept the UX cost in this milestone
- **Streaming reranker / partial results during retrieval** — retrieval stays request/response; only generation streams
- **Re-embedding fallback / migration script preserving chunk_ids on embedding upgrade** — wipe + rebuild ChromaDB is acceptable on the embedding-upgrade phase
- **Backend test suite** — known gap (no backend tests today); not in this milestone, separate concern

## Context

**Existing implementation** (see `.planning/codebase/`):
- Layered FastAPI service architecture; ingestion + RAG flows wired through services in `backend/services/`
- Retrieval is currently **pure dense cosine** with no rerank, no hybrid, no query rewrite — `RetrievalService.search()` is the natural insertion point for all 6 improvements
- `ChunkingService` uses LangChain `RecursiveCharacterTextSplitter` with hard-coded 512/51 — config will need to change for semantic chunking
- `EmbeddingService` wraps `ollama.embed(model="nomic-embed-text")` — model is configurable, swap target
- `RAGService` orchestrates retrieval → prompt construction → Ollama chat streaming — reranker + query-rewrite slot in here
- ChromaDB persistent client at `backend/uploads/vectors/` — wipe + rebuild needed on Phase 3
- `metadata.json` document index uses `asyncio.Lock`; chunk metadata schema may need to grow (parent-chunk references, BM25 doc IDs)

**Failure modes that motivate the work** (user-reported):
- Acronyms / proper nouns / exact-match queries miss → hybrid search target
- Conversational follow-ups ("the second one") miss → query rewrite target
- Multi-document questions return single-doc context → reranker + parent-doc retrieval target
- Retrieved chunks too small/fragmented → smarter chunking + parent-doc target

**Document corpus is mixed**: technical/code-heavy, long-form narrative, structured/tabular PDFs. Optimize for the general case but the chunking strategy must respect structure (split on headings, not just length).

## Constraints

- **Tech stack**: Python/FastAPI backend, React 19/Vite frontend, Ollama for LLM/embeddings, ChromaDB for vectors, SQLite for sessions — already locked, do not introduce parallel stacks
- **Local-first**: Everything runs on the user's machine. No external API calls. Ollama is the default; sentence-transformers / FlagEmbedding allowed for techniques where Ollama support is weak (e.g., cross-encoder reranker), but installation must remain `pip install -r requirements.txt` plus `ollama pull` — no manual model downloads
- **Multilingual**: Models must handle 100+ languages reasonably (bge-m3, bge-reranker-v2-m3 baseline) — multilingual quality > English-only quality
- **CPU-acceptable**: Reranker must run locally on CPU in reasonable time (target <100ms for 30 candidates); GPU is a bonus, not a requirement
- **Backwards-compat for sessions/UI**: API contracts (`/api/chat`, `/api/documents`) stay stable from frontend's view; internal pipeline changes don't leak to UI
- **Wipe + rebuild on embedding swap**: Phase 3 (embedding upgrade) requires re-ingesting all uploaded documents; explicitly acceptable, not a concern to migrate around

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Ship all 6 improvements as a prioritized milestone | User confirmed all 6 in scope; ordering matches expected impact (reranker biggest single win first) | — Pending |
| Multilingual model family (bge-m3 + bge-reranker-v2-m3) | User uploads include non-English docs; multilingual baseline > English-only specialization | — Pending |
| Vibe-check evaluation, not labeled eval set | User wants to ship, not measure; representative-query before/after sufficient for this milestone | — Pending |
| Per-task tool choice (Ollama vs sentence-transformers/FlagEmbedding) | Cross-encoder rerankers have weak Ollama support; allow ML deps where they unlock quality | — Pending |
| Wipe + rebuild ChromaDB on embedding upgrade | Avoids migration complexity; user explicitly accepted re-indexing cost | — Pending |
| Contextual Retrieval uses local Ollama LLM (not cloud) | Local-first constraint; accept slower ingestion for retrieval-quality gain | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-21 after Phase 4 completion*
