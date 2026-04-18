"""
Search request/response models for semantic search API.

Defines data structures for search queries and results with source attribution.
"""

from typing import Optional

from pydantic import BaseModel


class SearchResult(BaseModel):
    """Individual search result with source attribution and diagnostic scores."""
    text: str
    source_filename: str
    source_doc_id: str
    chunk_position: str  # Format: "3/15" (chunk 3 of 15)
    relevance_score: float  # 0-1 range (higher = more relevant)
    # Diagnostic scores for retrieval pipeline transparency
    reranker_score: Optional[float] = None  # 0-1 normalized cross-encoder score
    bm25_rank: Optional[int] = None  # rank in BM25 results (1-indexed)
    dense_rank: Optional[int] = None  # rank in dense results (1-indexed)
    retrieval_method: str = "dense"  # 'reranked' | 'rrf_only' | 'dense'


class SearchResponse(BaseModel):
    """Complete search response with query and results."""
    query: str
    results: list[SearchResult]
    total_results: int
