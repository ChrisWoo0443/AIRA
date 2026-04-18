"""
Hybrid retrieval service with dense + BM25 search, RRF fusion, and reranking.

Embeds user queries, performs dense search via ChromaDB, keyword search via
BM25, fuses results using Reciprocal Rank Fusion, and reranks with a
cross-encoder model (timeout-guarded with graceful fallback).
"""

import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from typing import Optional

from services.embedding_service import generate_embeddings
from services.vector_service import get_collection
from services import reranker_service
from services import bm25_index_service
from config import (
    RERANKER_CANDIDATE_COUNT, RERANK_OUTPUT_SIZE, RERANKER_TIMEOUT_MS,
    RRF_K, RRF_DENSE_WEIGHT, RRF_BM25_WEIGHT, BM25_TOP_K,
)

logger = logging.getLogger(__name__)
_rerank_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="reranker")


def _query_dense(
    query_embedding: list[float],
    candidate_count: int,
    doc_ids: Optional[list[str]] = None
) -> list[dict]:
    """
    Query ChromaDB for dense (embedding-based) retrieval candidates.

    Args:
        query_embedding: Query vector
        candidate_count: Number of candidates to over-retrieve
        doc_ids: Optional document ID filter

    Returns:
        List of result dicts with chunk_id for RRF matching
    """
    where_clause = None
    if doc_ids:
        if len(doc_ids) == 1:
            where_clause = {"doc_id": {"$eq": doc_ids[0]}}
        else:
            where_clause = {"doc_id": {"$in": doc_ids}}

    collection = get_collection()

    try:
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=candidate_count,
            where=where_clause,
            include=["documents", "metadatas", "distances"]
        )
    except Exception as e:
        if "no results" in str(e).lower():
            return []
        raise

    if not results["ids"] or not results["ids"][0]:
        return []

    formatted_results = []
    documents = results["documents"][0]
    metadatas = results["metadatas"][0]
    distances = results["distances"][0]

    for text, metadata, distance in zip(documents, metadatas, distances):
        relevance_score = 1.0 / (1.0 + distance)
        chunk_index = metadata["chunk_index"]
        total_chunks = metadata["total_chunks"]
        chunk_position = f"{chunk_index + 1}/{total_chunks}"
        chunk_id = f"{metadata['doc_id']}_chunk_{chunk_index}"

        formatted_results.append({
            "text": text,
            "source_filename": metadata["filename"],
            "source_doc_id": metadata["doc_id"],
            "chunk_position": chunk_position,
            "relevance_score": relevance_score,
            "chunk_id": chunk_id,
        })

    formatted_results.sort(key=lambda x: x["relevance_score"], reverse=True)
    return formatted_results


def reciprocal_rank_fusion(
    dense_results: list[dict],
    bm25_results: list[dict],
    k: int,
    dense_weight: float,
    bm25_weight: float
) -> list[dict]:
    """
    Fuse dense and BM25 ranked lists using Reciprocal Rank Fusion.

    Merges results from both retrieval methods, giving higher scores to
    documents that appear in both lists. Results appearing only in BM25
    are looked up from ChromaDB for full metadata.

    Args:
        dense_results: Ranked list from dense retrieval (full metadata)
        bm25_results: Ranked list from BM25 (chunk_id + bm25_score only)
        k: RRF smoothing constant (typically 60)
        dense_weight: Weight multiplier for dense scores
        bm25_weight: Weight multiplier for BM25 scores

    Returns:
        Fused list sorted by fused_score descending, with dense_rank
        and bm25_rank fields set (None if not present in that source)
    """
    fused_scores: dict[str, float] = {}
    result_lookup: dict[str, dict] = {}

    # Score dense results
    for rank, result in enumerate(dense_results):
        chunk_id = result["chunk_id"]
        fused_scores[chunk_id] = fused_scores.get(chunk_id, 0.0)
        fused_scores[chunk_id] += dense_weight / (k + rank + 1)
        result["dense_rank"] = rank + 1
        result_lookup[chunk_id] = result

    # Score BM25 results
    for rank, bm25_result in enumerate(bm25_results):
        chunk_id = bm25_result["chunk_id"]
        fused_scores[chunk_id] = fused_scores.get(chunk_id, 0.0)
        fused_scores[chunk_id] += bm25_weight / (k + rank + 1)

        if chunk_id in result_lookup:
            # Document in both lists: add BM25 rank to existing entry
            result_lookup[chunk_id]["bm25_rank"] = rank + 1
        else:
            # BM25-only: need full metadata from ChromaDB
            bm25_only_result = _fetch_chunk_metadata(chunk_id)
            if bm25_only_result:
                bm25_only_result["bm25_rank"] = rank + 1
                result_lookup[chunk_id] = bm25_only_result

    # Build final fused list
    fused_list = []
    for chunk_id, fused_score in fused_scores.items():
        if chunk_id not in result_lookup:
            continue
        result = result_lookup[chunk_id]
        result["fused_score"] = fused_score
        result.setdefault("dense_rank", None)
        result.setdefault("bm25_rank", None)
        fused_list.append(result)

    fused_list.sort(key=lambda x: x["fused_score"], reverse=True)
    return fused_list


def _fetch_chunk_metadata(chunk_id: str) -> Optional[dict]:
    """
    Fetch full chunk metadata from ChromaDB for a BM25-only result.

    Args:
        chunk_id: The chunk identifier to look up

    Returns:
        Dict with full result fields, or None if not found
    """
    try:
        collection = get_collection()
        result = collection.get(
            ids=[chunk_id],
            include=["documents", "metadatas"]
        )
        if not result["ids"]:
            return None

        text = result["documents"][0]
        metadata = result["metadatas"][0]
        chunk_index = metadata["chunk_index"]
        total_chunks = metadata["total_chunks"]

        return {
            "text": text,
            "source_filename": metadata["filename"],
            "source_doc_id": metadata["doc_id"],
            "chunk_position": f"{chunk_index + 1}/{total_chunks}",
            "relevance_score": 0.0,
            "chunk_id": chunk_id,
        }
    except Exception:
        logger.warning("Failed to fetch metadata for chunk %s", chunk_id)
        return None


def search_documents(
    query: str,
    top_k: int = 5,
    doc_ids: Optional[list[str]] = None
) -> list[dict]:
    """
    Search for relevant document chunks using hybrid retrieval.

    Pipeline: dense over-retrieval -> BM25 keyword search -> RRF fusion ->
    cross-encoder reranking (with timeout fallback to RRF-only results).

    Args:
        query: User's search query text
        top_k: Maximum number of results (default: 5, internally uses config)
        doc_ids: Optional list of document IDs to filter results
                 (None = search all documents)

    Returns:
        List of dicts with all SearchResult fields plus diagnostic scores,
        sorted by final ranking

    Raises:
        RuntimeError: If Ollama embedding service is unavailable
    """
    # Generate query embedding
    try:
        query_embeddings = generate_embeddings([query])
        query_embedding = query_embeddings[0]
    except RuntimeError as e:
        raise RuntimeError(f"Cannot search: {str(e)}") from e

    # Dense over-retrieval from ChromaDB
    dense_results = _query_dense(
        query_embedding, RERANKER_CANDIDATE_COUNT, doc_ids
    )

    if not dense_results:
        return []

    # BM25 keyword search
    bm25_results = bm25_index_service.search(query, BM25_TOP_K)

    # Determine candidates for reranking
    if bm25_results:
        # Hybrid path: fuse dense + BM25 via RRF
        fused_candidates = reciprocal_rank_fusion(
            dense_results, bm25_results,
            RRF_K, RRF_DENSE_WEIGHT, RRF_BM25_WEIGHT
        )
    else:
        # Dense-only fallback: no BM25 index or empty results
        logger.info("BM25 index empty, using dense-only retrieval")
        fused_candidates = dense_results
        for rank, candidate in enumerate(fused_candidates):
            candidate.setdefault("dense_rank", rank + 1)
            candidate.setdefault("bm25_rank", None)
            candidate.setdefault("fused_score", candidate["relevance_score"])

    # Timeout-guarded reranking
    try:
        future = _rerank_executor.submit(
            reranker_service.rerank, query, fused_candidates,
            RERANK_OUTPUT_SIZE
        )
        reranked = future.result(timeout=RERANKER_TIMEOUT_MS / 1000.0)
        retrieval_method = "reranked"
    except FuturesTimeoutError:
        logger.warning(
            "Reranker timed out after %dms, using RRF-only results",
            RERANKER_TIMEOUT_MS
        )
        reranked = fused_candidates[:RERANK_OUTPUT_SIZE]
        retrieval_method = "rrf_only"
    except Exception as e:
        logger.warning("Reranker failed: %s, using RRF-only results", str(e))
        reranked = fused_candidates[:RERANK_OUTPUT_SIZE]
        retrieval_method = "rrf_only"

    # Set retrieval_method and ensure all diagnostic fields present
    for result in reranked:
        result["retrieval_method"] = retrieval_method
        result.setdefault("reranker_score", None)
        result.setdefault("bm25_rank", None)
        result.setdefault("dense_rank", None)

    return reranked
