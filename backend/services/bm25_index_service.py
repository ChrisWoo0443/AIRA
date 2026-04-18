"""
BM25 index service for keyword-based document search.

Maintains a BM25Okapi index in memory with disk persistence via pickle.
Pickle is required here because BM25Okapi objects cannot be serialized
with JSON. The index is only loaded from files written by this service.
Supports add, remove, search, and automatic rebuild on corruption.
"""

import json
import logging
import os
import pickle
import tempfile
from pathlib import Path
from typing import Dict, List, Optional

from rank_bm25 import BM25Okapi

from config import BM25_TOP_K

logger = logging.getLogger(__name__)

BM25_DIR = Path("uploads/bm25")
BM25_DIR.mkdir(parents=True, exist_ok=True)

INDEX_PATH = BM25_DIR / "index.pkl"
CORPUS_MAP_PATH = BM25_DIR / "corpus_map.json"

_bm25: Optional[BM25Okapi] = None
_tokenized_corpus: List[List[str]] = []
_corpus_chunk_ids: List[str] = []
_doc_to_chunks: Dict[str, List[int]] = {}
_loaded: bool = False


def _tokenize(text: str) -> List[str]:
    """Simple whitespace + lowercase tokenization for BM25."""
    return text.lower().split()


def _ensure_loaded():
    """Load index from disk if not already loaded."""
    global _loaded
    if not _loaded:
        _try_load_from_disk()
        _loaded = True


def _try_load_from_disk():
    """Attempt to restore BM25 index state from disk."""
    global _bm25, _tokenized_corpus, _corpus_chunk_ids, _doc_to_chunks

    try:
        with open(INDEX_PATH, "rb") as f:
            data = pickle.load(f)
        _bm25 = data["bm25"]
        _tokenized_corpus = data["tokenized_corpus"]
        _corpus_chunk_ids = data["corpus_chunk_ids"]
        _doc_to_chunks = data["doc_to_chunks"]
        logger.info("BM25 index loaded from disk (%d chunks)", len(_corpus_chunk_ids))
    except FileNotFoundError:
        logger.info("BM25 index not found, starting empty")
        _bm25 = None
        _tokenized_corpus = []
        _corpus_chunk_ids = []
        _doc_to_chunks = {}
    except Exception:
        logger.warning("BM25 index not found or corrupt, starting empty", exc_info=True)
        _bm25 = None
        _tokenized_corpus = []
        _corpus_chunk_ids = []
        _doc_to_chunks = {}


def _persist_to_disk():
    """Atomically write BM25 index state to disk."""
    data = {
        "bm25": _bm25,
        "tokenized_corpus": _tokenized_corpus,
        "corpus_chunk_ids": _corpus_chunk_ids,
        "doc_to_chunks": _doc_to_chunks,
    }

    # Atomic write: temp file then rename (Pitfall 6 mitigation)
    temp_fd, temp_path = tempfile.mkstemp(dir=str(BM25_DIR), suffix=".tmp")
    try:
        with os.fdopen(temp_fd, "wb") as f:
            pickle.dump(data, f)
        os.replace(temp_path, str(INDEX_PATH))
    except Exception:
        if os.path.exists(temp_path):
            os.unlink(temp_path)
        raise

    # Write corpus map JSON for rebuild capability
    corpus_map = {}
    for doc_id, indices in _doc_to_chunks.items():
        for idx in indices:
            if idx < len(_corpus_chunk_ids):
                corpus_map[_corpus_chunk_ids[idx]] = doc_id

    with open(CORPUS_MAP_PATH, "w") as f:
        json.dump(corpus_map, f)


def _reindex_doc_to_chunks():
    """Rebuild _doc_to_chunks by scanning chunk_ids for doc_id prefixes."""
    global _doc_to_chunks

    new_mapping: Dict[str, List[int]] = {}
    for idx, chunk_id in enumerate(_corpus_chunk_ids):
        for doc_id in list(_doc_to_chunks.keys()):
            if chunk_id.startswith(doc_id):
                if doc_id not in new_mapping:
                    new_mapping[doc_id] = []
                new_mapping[doc_id].append(idx)
                break

    _doc_to_chunks = new_mapping


def get_bm25_status() -> str:
    """Return 'ready' if index has documents, 'empty' if no documents."""
    _ensure_loaded()
    if _bm25 is not None and len(_tokenized_corpus) > 0:
        return "ready"
    return "empty"


def add_document(doc_id: str, chunks: List[str], chunk_ids: List[str]) -> None:
    """
    Add a document's chunks to the BM25 index.

    Args:
        doc_id: Unique document identifier
        chunks: List of text chunks to index
        chunk_ids: List of unique chunk identifiers (parallel to chunks)
    """
    global _bm25, _tokenized_corpus, _corpus_chunk_ids, _doc_to_chunks

    _ensure_loaded()

    start_index = len(_tokenized_corpus)
    tokenized_chunks = [_tokenize(chunk) for chunk in chunks]

    _tokenized_corpus.extend(tokenized_chunks)
    _corpus_chunk_ids.extend(chunk_ids)
    _doc_to_chunks[doc_id] = list(range(start_index, start_index + len(chunks)))

    # rank_bm25 has no incremental add; rebuild from full corpus
    _bm25 = BM25Okapi(_tokenized_corpus)

    _persist_to_disk()
    logger.info("Added %d chunks for document %s to BM25 index", len(chunks), doc_id)


def remove_document(doc_id: str) -> None:
    """
    Remove a document's chunks from the BM25 index and rebuild.

    Args:
        doc_id: Document identifier to remove
    """
    global _bm25, _tokenized_corpus, _corpus_chunk_ids, _doc_to_chunks

    _ensure_loaded()

    indices_to_remove = _doc_to_chunks.pop(doc_id, [])
    if not indices_to_remove:
        return

    removal_set = set(indices_to_remove)

    _tokenized_corpus = [
        tokens for idx, tokens in enumerate(_tokenized_corpus)
        if idx not in removal_set
    ]
    _corpus_chunk_ids = [
        chunk_id for idx, chunk_id in enumerate(_corpus_chunk_ids)
        if idx not in removal_set
    ]

    _reindex_doc_to_chunks()

    if _tokenized_corpus:
        _bm25 = BM25Okapi(_tokenized_corpus)
    else:
        _bm25 = None

    _persist_to_disk()
    logger.info("Removed document %s from BM25 index", doc_id)


def search(query: str, top_k: int = BM25_TOP_K) -> List[dict]:
    """
    Search the BM25 index for relevant chunks.

    Args:
        query: Search query text
        top_k: Maximum number of results to return

    Returns:
        List of dicts with "chunk_id" and "bm25_score" keys,
        sorted by score descending. Zero-score results excluded.
    """
    _ensure_loaded()

    if _bm25 is None or len(_tokenized_corpus) == 0:
        return []

    tokenized_query = _tokenize(query)
    scores = _bm25.get_scores(tokenized_query)

    scored_indices = sorted(
        range(len(scores)),
        key=lambda i: scores[i],
        reverse=True
    )

    results = []
    for idx in scored_indices[:top_k]:
        score = float(scores[idx])
        if score > 0:
            results.append({
                "chunk_id": _corpus_chunk_ids[idx],
                "bm25_score": score,
            })

    return results
