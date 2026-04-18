"""Tests for BM25 index service with persistence."""

import json
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


@pytest.fixture
def bm25_tmp_dir(tmp_path, monkeypatch):
    """Redirect BM25 storage to a temporary directory."""
    import services.bm25_index_service as mod

    bm25_dir = tmp_path / "bm25"
    bm25_dir.mkdir()

    monkeypatch.setattr(mod, "BM25_DIR", bm25_dir)
    monkeypatch.setattr(mod, "INDEX_PATH", bm25_dir / "index.pkl")
    monkeypatch.setattr(mod, "CORPUS_MAP_PATH", bm25_dir / "corpus_map.json")

    # Reset module state
    mod._bm25 = None
    mod._tokenized_corpus = []
    mod._corpus_chunk_ids = []
    mod._doc_to_chunks = {}
    mod._loaded = False

    yield bm25_dir

    # Cleanup
    mod._bm25 = None
    mod._tokenized_corpus = []
    mod._corpus_chunk_ids = []
    mod._doc_to_chunks = {}
    mod._loaded = False


def test_search_returns_empty_when_empty(bm25_tmp_dir):
    from services.bm25_index_service import search
    results = search("test query", top_k=5)
    assert results == []


def test_status_empty_initially(bm25_tmp_dir):
    from services.bm25_index_service import get_bm25_status
    assert get_bm25_status() == "empty"


def test_add_then_search_finds_chunks(bm25_tmp_dir):
    from services.bm25_index_service import add_document, search
    # BM25 IDF needs 3+ docs for positive scores on partial term overlap
    chunks = [
        "python programming language",
        "machine learning algorithms",
        "java enterprise applications",
    ]
    chunk_ids = ["doc1_chunk_0", "doc1_chunk_1", "doc1_chunk_2"]
    add_document("doc1", chunks, chunk_ids)

    results = search("python programming", top_k=5)
    assert len(results) > 0
    assert any(r["chunk_id"] == "doc1_chunk_0" for r in results)


def test_search_sorted_by_score_descending(bm25_tmp_dir):
    from services.bm25_index_service import add_document, search
    chunks = [
        "python programming language basics",
        "advanced python data structures",
        "java enterprise applications",
    ]
    chunk_ids = ["doc1_c0", "doc1_c1", "doc1_c2"]
    add_document("doc1", chunks, chunk_ids)

    results = search("python programming", top_k=3)
    scores = [r["bm25_score"] for r in results]
    assert scores == sorted(scores, reverse=True)


def test_remove_document_then_search_excludes_removed(bm25_tmp_dir):
    from services.bm25_index_service import add_document, remove_document, search
    add_document("doc1", ["alpha beta gamma"], ["doc1_c0"])
    add_document("doc2", ["delta epsilon zeta"], ["doc2_c0"])
    add_document("doc3", ["unrelated filler content"], ["doc3_c0"])

    remove_document("doc1")

    results = search("alpha beta", top_k=5)
    chunk_ids_found = [r["chunk_id"] for r in results]
    assert "doc1_c0" not in chunk_ids_found


def test_status_ready_after_add(bm25_tmp_dir):
    from services.bm25_index_service import add_document, get_bm25_status
    add_document("doc1", ["some text"], ["doc1_c0"])
    assert get_bm25_status() == "ready"


def test_persistence_survives_reload(bm25_tmp_dir):
    import services.bm25_index_service as mod
    from services.bm25_index_service import add_document, search

    # Need 3+ chunks for BM25 IDF to produce positive scores
    add_document("doc1", [
        "persisted content data",
        "unrelated filler text",
        "another different topic",
    ], ["doc1_c0", "doc1_c1", "doc1_c2"])

    # Simulate process restart by clearing in-memory state
    mod._bm25 = None
    mod._tokenized_corpus = []
    mod._corpus_chunk_ids = []
    mod._doc_to_chunks = {}
    mod._loaded = False

    results = search("persisted content", top_k=5)
    assert len(results) > 0
    assert results[0]["chunk_id"] == "doc1_c0"


def test_corrupt_index_file_fallback(bm25_tmp_dir):
    """Corrupt index file triggers safe fallback to empty state."""
    import services.bm25_index_service as mod

    # Write invalid data to index file
    index_path = bm25_tmp_dir / "index.pkl"
    index_path.write_bytes(b"this is not valid serialized data")

    # Reset state so it tries to load from disk
    mod._bm25 = None
    mod._tokenized_corpus = []
    mod._corpus_chunk_ids = []
    mod._doc_to_chunks = {}
    mod._loaded = False

    from services.bm25_index_service import get_bm25_status
    # Should not crash, should return empty
    status = get_bm25_status()
    assert status == "empty"


def test_zero_score_results_excluded(bm25_tmp_dir):
    from services.bm25_index_service import add_document, search
    chunks = [
        "python programming language",
        "completely unrelated marine biology",
        "java enterprise applications",
    ]
    chunk_ids = ["doc1_c0", "doc1_c1", "doc1_c2"]
    add_document("doc1", chunks, chunk_ids)

    results = search("python programming", top_k=5)
    for result in results:
        assert result["bm25_score"] > 0


def test_search_returns_chunk_id_and_bm25_score_keys(bm25_tmp_dir):
    from services.bm25_index_service import add_document, search
    add_document("doc1", [
        "example text content",
        "unrelated filler material",
        "another different subject",
    ], ["doc1_c0", "doc1_c1", "doc1_c2"])
    results = search("example text", top_k=5)
    assert len(results) > 0
    assert "chunk_id" in results[0]
    assert "bm25_score" in results[0]


def test_add_multiple_documents(bm25_tmp_dir):
    from services.bm25_index_service import add_document, search
    add_document("doc1", ["first document text"], ["doc1_c0"])
    add_document("doc2", ["second document text"], ["doc2_c0"])
    add_document("doc3", ["unrelated filler material"], ["doc3_c0"])

    results = search("document text", top_k=10)
    chunk_ids = [r["chunk_id"] for r in results]
    assert "doc1_c0" in chunk_ids
    assert "doc2_c0" in chunk_ids
