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

# Embedding
EMBEDDING_MODEL = "bge-m3"
EMBEDDING_DIMENSIONS = 1024

# Semantic Chunking
PARENT_CHUNK_SIZE = 1000       # tokens (tiktoken cl100k_base)
PARENT_CHUNK_OVERLAP = 100     # ~10% overlap
CHILD_CHUNK_SIZE = 300         # tokens (tiktoken cl100k_base)
CHILD_CHUNK_OVERLAP = 50       # ~15% overlap
HEADING_SEPARATORS = [
    "\n# ", "\n## ", "\n### ",  # Markdown headings
    "\n\n",                      # Paragraph breaks
    "\n",                        # Line breaks
    ". ",                        # Sentence boundaries (fallback)
    " ",                         # Word boundaries
    "",                          # Character fallback
]

# Contextual Retrieval (D-07: config-gated, default disabled)
CONTEXTUAL_RETRIEVAL_ENABLED = False
CONTEXT_GENERATION_MODEL = None  # None = use user's selected chat model (D-05)
CONTEXT_GENERATION_TIMEOUT = 300  # seconds per document (5 min max)
CONTEXT_VALIDATION_THRESHOLD = 0.7  # 70% term overlap required (D-06)

# Query Rewriting (per D-01: LLM-based classification)
QUERY_REWRITING_ENABLED = True
QUERY_REWRITE_MODEL = None            # None = use user's selected chat model
QUERY_REWRITE_HISTORY_WINDOW = 6      # last N messages for context (per D-02)
CONFIDENCE_GATE_THRESHOLD = 0.4       # cosine similarity floor for rewrites (per D-05)
HYDE_CONFIDENCE_GATE_THRESHOLD = 0.3  # lower threshold for HyDE passages (per D-05)
HYDE_PASSAGE_MAX_TOKENS = 150         # num_predict limit for HyDE generation
