"""
Search request/response models for semantic search API.

Defines data structures for search queries and results with source attribution.
"""

from pydantic import BaseModel


class SearchResult(BaseModel):
    """Individual search result with source attribution."""
    text: str
    source_filename: str
    source_doc_id: str
    chunk_position: str  # Format: "3/15" (chunk 3 of 15)
    relevance_score: float  # 0-1 range (higher = more relevant)


class SearchResponse(BaseModel):
    """Complete search response with query and results."""
    query: str
    results: list[SearchResult]
    total_results: int
