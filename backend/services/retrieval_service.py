"""
Retrieval service for semantic search across document chunks.

Embeds user queries and searches ChromaDB for relevant document chunks.
"""

from typing import Optional
from services.embedding_service import generate_embeddings
from services.vector_service import get_collection


def search_documents(
    query: str,
    top_k: int = 5,
    doc_ids: Optional[list[str]] = None
) -> list[dict]:
    """
    Search for relevant document chunks using semantic similarity.

    Args:
        query: User's search query text
        top_k: Maximum number of results to return (default: 5)
        doc_ids: Optional list of document IDs to filter results
                 (None = search all documents)

    Returns:
        List of dicts matching SearchResult fields, sorted by relevance descending

    Raises:
        RuntimeError: If Ollama embedding service is unavailable
    """
    # Generate query embedding
    try:
        query_embeddings = generate_embeddings([query])
        query_embedding = query_embeddings[0]
    except RuntimeError as e:
        raise RuntimeError(f"Cannot search: {str(e)}") from e

    # Build ChromaDB where clause for filtering
    where_clause = None
    if doc_ids:
        if len(doc_ids) == 1:
            where_clause = {"doc_id": {"$eq": doc_ids[0]}}
        else:
            where_clause = {"doc_id": {"$in": doc_ids}}

    # Query ChromaDB collection
    collection = get_collection()

    try:
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=where_clause,
            include=["documents", "metadatas", "distances"]
        )
    except Exception as e:
        # Handle empty collection gracefully
        if "no results" in str(e).lower() or not results.get('ids') or not results['ids'][0]:
            return []
        raise

    # Handle empty results
    if not results['ids'] or not results['ids'][0]:
        return []

    # Format results
    formatted_results = []
    documents = results['documents'][0]
    metadatas = results['metadatas'][0]
    distances = results['distances'][0]

    for i, (text, metadata, distance) in enumerate(zip(documents, metadatas, distances)):
        # Convert distance to similarity score (0-1 range, higher = more relevant)
        # ChromaDB cosine distance is 0-2, so we convert: similarity = 1 / (1 + distance)
        relevance_score = 1.0 / (1.0 + distance)

        # Format chunk position
        chunk_index = metadata['chunk_index']
        total_chunks = metadata['total_chunks']
        chunk_position = f"{chunk_index + 1}/{total_chunks}"

        formatted_results.append({
            "text": text,
            "source_filename": metadata['filename'],
            "source_doc_id": metadata['doc_id'],
            "chunk_position": chunk_position,
            "relevance_score": relevance_score
        })

    # ChromaDB already returns results sorted by distance (best first)
    # But ensure descending order by relevance_score
    formatted_results.sort(key=lambda x: x['relevance_score'], reverse=True)

    return formatted_results
