# Roadmap: AIRA RAG Quality Improvements

## Overview

This milestone transforms AIRA's retrieval pipeline from naive dense cosine search into a production-quality RAG system. The work moves from query-side improvements (reranking, hybrid search) that deliver immediate wins with zero re-ingestion, through an embedding upgrade that rebuilds the vector space, to ingestion-side improvements (semantic chunking, contextual retrieval) that restructure how documents are stored, and finally query rewriting that fixes conversational follow-up failures. Each phase delivers measurable retrieval quality gains vibe-checked against representative queries.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Reranking + Hybrid Search** - Add cross-encoder reranking and BM25 keyword search with RRF fusion to fix noisy retrieval and exact-match failures
- [x] **Phase 2: Embedding Upgrade** - Swap to bge-m3 embeddings with ChromaDB wipe and rebuild for multilingual support and higher quality vectors (completed 2026-04-20)
- [ ] **Phase 3: Semantic Chunking + Contextual Retrieval** - Replace fixed-size chunking with heading-aware semantic chunks, add parent-document retrieval, and prepend LLM-generated context summaries
- [ ] **Phase 4: Query Rewriting** - Rewrite conversational follow-ups and abstract queries before retrieval to fix reference resolution failures

## Phase Details

### Phase 1: Reranking + Hybrid Search
**Goal**: Users get relevant results for exact-match queries (acronyms, proper nouns) and the top 5 results consistently contain the answer, not noise
**Depends on**: Nothing (first phase)
**Requirements**: RERANK-01, RERANK-02, RERANK-03, RERANK-04, RERANK-05, HYBRD-01, HYBRD-02, HYBRD-03, HYBRD-04, HYBRD-05
**Success Criteria** (what must be TRUE):
  1. User asks an acronym or proper noun query and gets relevant chunks (BM25 catches what dense misses)
  2. User queries consistently return top-5 results where the answer is in position 1-3 instead of buried in positions 5-10
  3. Reranker responds within 200ms on CPU; if it exceeds timeout, results still return via dense-only fallback
  4. BM25 index survives application restart without requiring a full rebuild from documents
  5. Deleting a document correctly updates the BM25 index (no stale results from deleted docs)
**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md -- Config, models, reranker service, BM25 index service, dependencies
- [x] 01-02-PLAN.md -- Hybrid retrieval pipeline wiring, ingestion/delete hooks, health endpoint
- [ ] 01-03-PLAN.md -- Integration tests and live smoke test verification

### Phase 2: Embedding Upgrade
**Goal**: Swap embedding model to bge-m3 for multilingual retrieval quality and longer context windows, with startup dimension validation to prevent silent mismatches
**Depends on**: Phase 1
**Requirements**: EMBED-01, EMBED-02, EMBED-03, EMBED-04
**Success Criteria** (what must be TRUE):
  1. Application startup validates that ChromaDB embedding dimensions match the configured model (no silent mismatches)
  2. Non-English document queries return relevant chunks where nomic-embed-text previously missed them
  3. Rollback is possible by changing config constants back and wiping the collection
**Plans:** 1/1 plans complete

Plans:
- [x] 02-01-PLAN.md -- Config constants, embedding service model swap, startup dimension validation

### Phase 3: Semantic Chunking + Contextual Retrieval
**Goal**: Documents are chunked along natural boundaries (headings, paragraphs) instead of arbitrary character counts, and each chunk carries LLM-generated context describing where it sits in the source document
**Depends on**: Phase 2
**Requirements**: CHUNK-01, CHUNK-02, CHUNK-03, CHUNK-04, CXRET-01, CXRET-02, CXRET-03
**Success Criteria** (what must be TRUE):
  1. User uploads a structured document (with headings) and chunks align with section boundaries instead of splitting mid-sentence
  2. User uploads an unstructured PDF (no headings) and chunks still split cleanly via size-based fallback with overlap
  3. Retrieved chunks returned to the LLM include parent context (~1000 tokens) even though smaller children (~300 tokens) were embedded
  4. Each chunk carries a prepended context summary and the summary only references terms that appear in the source document (no hallucinated terms)
  5. Chunk sizes use token-accurate counting (tiktoken) instead of character counting
**Plans:** 3 plans

Plans:
- [x] 03-01-PLAN.md -- Semantic chunking service rewrite with tiktoken, heading-aware splitting, parent-child mapping
- [x] 03-02-PLAN.md -- Ingestion pipeline wiring, ChromaDB parent metadata, parent expansion in retrieval
- [x] 03-03-PLAN.md -- Config-gated contextual retrieval service with anti-hallucination validation

### Phase 4: Query Rewriting
**Goal**: Conversational follow-ups and abstract queries are resolved against session history before retrieval, so "what about the second one?" returns the right chunks
**Depends on**: Phase 3
**Requirements**: QRWRT-01, QRWRT-02, QRWRT-03, QRWRT-04
**Success Criteria** (what must be TRUE):
  1. User asks a follow-up like "what about the second one?" and the system rewrites it into a standalone query that retrieves relevant chunks
  2. User asks a clear standalone question and it passes through without unnecessary rewriting (no added latency)
  3. HyDE generates a hypothetical answer for abstract queries and uses that embedding for retrieval
  4. If a rewrite drifts off-topic, the system falls back to the original query instead of returning irrelevant results
**Plans:** 2 plans

Plans:
- [x] 04-01-PLAN.md -- Query rewrite service: LLM classification, conversational rewriting, HyDE, confidence gate, config constants, unit tests
- [ ] 04-02-PLAN.md -- Pipeline wiring: integrate rewrite into rag_service, HyDE embedding pass-through in retrieval_service, integration tests

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Reranking + Hybrid Search | 2/3 | Executing (P03 checkpoint) | - |
| 2. Embedding Upgrade | 1/1 | Complete   | 2026-04-20 |
| 3. Semantic Chunking + Contextual Retrieval | 3/3 | Complete | 2026-04-21 |
| 4. Query Rewriting | 0/2 | Planned | - |
