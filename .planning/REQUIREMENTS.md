# Requirements: AIRA RAG Quality Improvements

**Defined:** 2026-04-15
**Core Value:** When a user asks a question over their uploaded documents, the retrieved chunks contain the answer the LLM needs to cite.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Cross-Encoder Reranking

- [x] **RERANK-01**: Retrieval over-retrieves top 30 dense candidates and reranks to top 5 using bge-reranker-v2-m3
- [x] **RERANK-02**: Reranker model loaded once at application startup as a singleton, warmed on first request
- [x] **RERANK-03**: Retrieval falls back to dense-only ranking if reranker exceeds 200ms hard timeout
- [x] **RERANK-04**: Reranker uses FP16/ONNX optimization for faster CPU inference when available
- [x] **RERANK-05**: Candidate count (over-retrieval depth) and rerank output size are configurable

### Hybrid Search

- [x] **HYBRD-01**: BM25 index is built alongside ChromaDB during document ingestion
- [x] **HYBRD-02**: Retrieval fuses dense + BM25 rankings using Reciprocal Rank Fusion (k=60)
- [x] **HYBRD-03**: BM25 index is fully rebuilt when a document is deleted (rank_bm25 has no delete API)
- [x] **HYBRD-04**: BM25 index is persisted to disk and survives application restarts without full rebuild
- [x] **HYBRD-05**: RRF fusion weights between dense and BM25 are configurable

### Embedding Upgrade

- [x] **EMBED-01**: Embedding model swapped from nomic-embed-text to bge-m3 (1024-dim, multilingual, 8192 token context)
- [x] **EMBED-02**: ChromaDB collection is atomically wiped and rebuilt with new embeddings; startup validates embedding dimensions match
- [x] **EMBED-03**: Re-indexing script processes all uploaded documents with progress indication
- [x] **EMBED-04**: Rollback path exists to revert to nomic-embed-text if bge-m3 quality is worse on specific corpus

### Semantic Chunking + Parent-Document Retrieval

- [x] **CHUNK-01**: Documents are split into semantic chunks (~800 tokens) using heading/paragraph-aware splitting before falling back to size-based splitting
- [x] **CHUNK-02**: Parent-child chunk mapping: small children (~300 tokens) are embedded, larger parents (~1000 tokens) are returned to the LLM
- [x] **CHUNK-03**: Chunk sizing uses token-accurate counting via tiktoken instead of character counting
- [x] **CHUNK-04**: Unstructured PDFs without clear headings fall back gracefully to size-based splitting with overlap

### Contextual Retrieval

- [x] **CXRET-01**: At ingest time, each chunk is prepended with a 1-2 sentence LLM-generated summary describing where the chunk sits in the source document
- [x] **CXRET-02**: Context summary is stored as chunk metadata and prepended to chunk text before embedding and BM25 indexing
- [x] **CXRET-03**: Context generation validates that key terms in the summary appear in the source document (anti-hallucination check)

### Query Rewriting

- [x] **QRWRT-01**: Conversational follow-up queries are rewritten using session history before embedding
- [x] **QRWRT-02**: Standalone queries (no ambiguous references) pass through without unnecessary rewriting
- [x] **QRWRT-03**: HyDE generates a hypothetical answer for abstract queries and embeds that instead of the raw query
- [x] **QRWRT-04**: Confidence gate falls back to original query if the rewrite appears off-topic (topic drift protection)

## v2 Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Advanced Retrieval

- **ADVRT-01**: ColBERT late-interaction retrieval for fine-grained token-level matching
- **ADVRT-02**: Learned sparse retrieval (SPLADE or bge-m3 sparse vectors) replacing BM25
- **ADVRT-03**: Agent-style multi-hop retrieval for complex multi-document synthesis queries

### Observability

- **OBSRV-01**: Retrieval quality metrics dashboard (latency, recall, reranker hit rate)
- **OBSRV-02**: Labeled evaluation query set with automated recall@k tracking after each phase

### Infrastructure

- **INFRA-01**: Background job queue for asynchronous document ingestion
- **INFRA-02**: Backend test suite covering retrieval pipeline end-to-end

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Cloud-hosted models / external APIs | Local-first is non-negotiable; everything runs on user's machine |
| English-only model optimization | Multilingual required; bge-m3 + bge-reranker-v2-m3 chosen over English-only variants |
| Streaming/partial retrieval results | Retrieval stays request/response; only generation streams |
| Database migration system (Alembic) | Wipe + rebuild is acceptable; no incremental vector migration needed |
| Frontend changes for retrieval quality | All improvements are backend-only; API contracts unchanged |
| GPU-required models | Everything must run acceptably on CPU; GPU is a bonus |
| Hyperparameter tuning infrastructure | Use published defaults; tune manually only if vibe-checks fail |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RERANK-01 | Phase 1 | Complete |
| RERANK-02 | Phase 1 | Complete |
| RERANK-03 | Phase 1 | Complete |
| RERANK-04 | Phase 1 | Complete |
| RERANK-05 | Phase 1 | Complete |
| HYBRD-01 | Phase 1 | Complete |
| HYBRD-02 | Phase 1 | Complete |
| HYBRD-03 | Phase 1 | Complete |
| HYBRD-04 | Phase 1 | Complete |
| HYBRD-05 | Phase 1 | Complete |
| EMBED-01 | Phase 2 | Complete |
| EMBED-02 | Phase 2 | Complete |
| EMBED-03 | Phase 2 | Complete |
| EMBED-04 | Phase 2 | Complete |
| CHUNK-01 | Phase 3 | Complete |
| CHUNK-02 | Phase 3 | Complete |
| CHUNK-03 | Phase 3 | Complete |
| CHUNK-04 | Phase 3 | Complete |
| CXRET-01 | Phase 3 | Complete |
| CXRET-02 | Phase 3 | Complete |
| CXRET-03 | Phase 3 | Complete |
| QRWRT-01 | Phase 4 | Complete |
| QRWRT-02 | Phase 4 | Complete |
| QRWRT-03 | Phase 4 | Complete |
| QRWRT-04 | Phase 4 | Complete |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-04-15*
*Last updated: 2026-04-15 after roadmap creation (coarse 4-phase structure)*
