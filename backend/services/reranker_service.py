"""
Reranker service using cross-encoder for relevance scoring.

Lazy-loads bge-reranker-v2-m3 on first use. Provides status tracking
for health endpoint integration.
"""

import logging
from typing import List

from FlagEmbedding import FlagReranker

from config import RERANKER_MODEL, RERANKER_USE_FP16

logger = logging.getLogger(__name__)

_reranker: FlagReranker = None
_reranker_status: str = "unavailable"


def get_reranker_status() -> str:
    """Return current reranker status: 'unavailable', 'loading', or 'ready'."""
    return _reranker_status


def _get_reranker() -> FlagReranker:
    """Lazy-load the reranker model singleton."""
    global _reranker, _reranker_status
    if _reranker is None:
        _reranker_status = "loading"
        try:
            logger.info("Loading reranker model (first query)...")
            _reranker = FlagReranker(
                RERANKER_MODEL,
                use_fp16=RERANKER_USE_FP16
            )
            _reranker_status = "ready"
            logger.info("Reranker model loaded")
        except Exception:
            _reranker_status = "unavailable"
            logger.error("Failed to load reranker model", exc_info=True)
            raise
    return _reranker


def rerank(
    query: str,
    candidates: List[dict],
    top_k: int = 5
) -> List[dict]:
    """
    Rerank candidates using cross-encoder scoring.

    Args:
        query: The search query text
        candidates: List of dicts, each must contain a "text" key
        top_k: Number of top results to return

    Returns:
        Top-k candidates sorted by reranker_score descending,
        each with "reranker_score" key added
    """
    reranker = _get_reranker()
    pairs = [[query, candidate["text"]] for candidate in candidates]
    scores = reranker.compute_score(pairs, normalize=True)

    # Pitfall 3: compute_score returns float for single pair
    if isinstance(scores, float):
        scores = [scores]

    for candidate, score in zip(candidates, scores):
        candidate["reranker_score"] = score

    ranked = sorted(candidates, key=lambda x: x["reranker_score"], reverse=True)
    return ranked[:top_k]
