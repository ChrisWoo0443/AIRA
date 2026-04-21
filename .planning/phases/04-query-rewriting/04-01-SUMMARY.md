---
phase: 04-query-rewriting
plan: 01
subsystem: api
tags: [ollama, pydantic, query-rewriting, hyde, embedding, cosine-similarity]

requires:
  - phase: 03-chunking-context
    provides: embedding_service.generate_embeddings for confidence gate
provides:
  - query_rewrite_service.py with classify_query, rewrite_followup, generate_hyde_passage, confidence_gate, rewrite_query
  - QueryType, QueryClassification, RewriteResult data models
  - Config constants QUERY_REWRITING_ENABLED, CONFIDENCE_GATE_THRESHOLD, HYDE_CONFIDENCE_GATE_THRESHOLD
affects: [04-02-PLAN, rag_service, retrieval_service]

tech-stack:
  added: []
  patterns: [ollama-structured-output-classification, embedding-based-confidence-gate, config-gated-llm-service]

key-files:
  created:
    - backend/services/query_rewrite_service.py
    - backend/tests/test_query_rewrite_service.py
  modified:
    - backend/config.py

key-decisions:
  - "History window of 6 messages (3 turns) balances context vs topic drift"
  - "Confidence gate threshold 0.4 for rewrites, 0.3 for HyDE (intentionally lower since HyDE diverges by design)"
  - "HyDE activation integrated into LLM classification via 'abstract' type rather than separate config flag"

patterns-established:
  - "Ollama structured output: format=Model.model_json_schema() + model_validate_json() for type-safe LLM responses"
  - "Embedding-based confidence gate: cosine similarity between original and rewritten queries to detect drift"

requirements-completed: [QRWRT-01, QRWRT-02, QRWRT-03, QRWRT-04]

duration: 4min
completed: 2026-04-21
---

# Phase 4 Plan 1: Query Rewrite Service Summary

**LLM-based query classification (standalone/follow_up/abstract) with conversational rewriting, HyDE passage generation, and embedding cosine-similarity confidence gate**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-21T19:10:38Z
- **Completed:** 2026-04-21T19:14:47Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Query rewrite service with full TDD coverage (20 tests, all passing)
- LLM-based classification using Ollama structured output (Pydantic schema)
- Conversational follow-up rewriting that resolves pronouns via session history
- HyDE hypothetical passage generation for abstract/conceptual queries
- Embedding-based confidence gate to detect and prevent topic drift
- Graceful fallback to original query on every failure path

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for query rewrite service** - `c00303d` (test)
2. **Task 1 (GREEN): Implement query rewrite service** - `5d10c91` (feat)

## Files Created/Modified
- `backend/services/query_rewrite_service.py` - Query classification, rewriting, HyDE generation, confidence gate, orchestrator
- `backend/tests/test_query_rewrite_service.py` - 20 unit tests covering all paths and failure modes
- `backend/config.py` - Added QUERY_REWRITING_ENABLED, QUERY_REWRITE_MODEL, QUERY_REWRITE_HISTORY_WINDOW, CONFIDENCE_GATE_THRESHOLD, HYDE_CONFIDENCE_GATE_THRESHOLD, HYDE_PASSAGE_MAX_TOKENS

## Decisions Made
- History window set to 6 messages (3 turns) per D-02 research recommendation for balancing context availability vs stale topic influence
- Confidence gate thresholds: 0.4 for rewrites, 0.3 for HyDE per D-05 (HyDE passages intentionally diverge further from original queries)
- HyDE gated through LLM classification (abstract type) rather than separate config flag per D-04 (simpler configuration surface)
- Classification uses temperature=0 for determinism, HyDE uses temperature=0.7 for slight creativity

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- query_rewrite_service.py ready to be wired into rag_service.py (Plan 02)
- rewrite_query returns RewriteResult with effective_query and optional hyde_embedding for search
- All exports stable: rewrite_query, classify_query, RewriteResult, QueryClassification, QueryType

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 04-query-rewriting*
*Completed: 2026-04-21*
