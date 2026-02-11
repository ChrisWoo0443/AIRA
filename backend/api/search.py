"""
Search API endpoint for semantic document retrieval.

Provides GET /search endpoint for querying documents using semantic similarity.
"""

from fastapi import APIRouter, HTTPException, Query
from models.search import SearchResult, SearchResponse
from services.retrieval_service import search_documents

router = APIRouter()


@router.get("/search", response_model=SearchResponse)
async def search(
    q: str = Query(..., description="Search query text"),
    top_k: int = Query(5, ge=1, le=20, description="Maximum results to return"),
    doc_ids: str = Query(None, description="Comma-separated document IDs to filter")
):
    """
    Search for relevant document chunks using semantic similarity.

    Args:
        q: Search query text (required)
        top_k: Maximum number of results (1-20, default: 5)
        doc_ids: Optional comma-separated document IDs for filtering

    Returns:
        SearchResponse with query, results list, and total count

    Raises:
        400: Missing or invalid query parameter
        503: Embedding service (Ollama) unavailable
    """
    # Parse doc_ids if provided
    parsed_doc_ids = None
    if doc_ids:
        parsed_doc_ids = [doc_id.strip() for doc_id in doc_ids.split(',') if doc_id.strip()]

    # Execute search
    try:
        results = search_documents(
            query=q,
            top_k=top_k,
            doc_ids=parsed_doc_ids
        )
    except RuntimeError as e:
        # Ollama embedding service unavailable
        if "Ollama" in str(e) or "embedding" in str(e).lower():
            raise HTTPException(
                status_code=503,
                detail="Embedding service unavailable. Please ensure Ollama is running."
            ) from e
        raise

    # Format response
    search_results = [SearchResult(**result) for result in results]
    return SearchResponse(
        query=q,
        results=search_results,
        total_results=len(search_results)
    )
