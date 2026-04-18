"""
Retrieval pipeline configuration.

Change defaults here; restart required. Per-request overrides via API params.
"""

# Reranker
RERANKER_MODEL = "BAAI/bge-reranker-v2-m3"
RERANKER_USE_FP16 = True
RERANKER_CANDIDATE_COUNT = 30
RERANK_OUTPUT_SIZE = 5
RERANKER_TIMEOUT_MS = 200

# RRF Fusion
RRF_K = 60
RRF_DENSE_WEIGHT = 1.0
RRF_BM25_WEIGHT = 1.0

# BM25
BM25_TOP_K = 30
