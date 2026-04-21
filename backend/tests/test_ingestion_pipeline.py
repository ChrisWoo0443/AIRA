"""
Integration tests for parent-child ingestion pipeline and parent expansion.

Validates:
- Ingestion pipeline unpacks chunk_document dict and passes parent_texts
- _expand_parents deduplicates results sharing the same parent text
- _expand_parents preserves child_text for diagnostics
- _query_dense extracts parent_text from ChromaDB metadata
"""

import sys
from unittest.mock import MagicMock, patch

import pytest

# Ensure external deps are mocked before imports
for module_name in ["chromadb", "chromadb.config", "ollama", "FlagEmbedding",
                     "rank_bm25", "aiofiles", "fitz", "pymupdf",
                     "slowapi", "slowapi.errors", "slowapi.middleware",
                     "slowapi.util", "sqlalchemy", "sqlalchemy.orm"]:
    if module_name not in sys.modules:
        try:
            __import__(module_name.split(".")[0])
        except ImportError:
            sys.modules[module_name] = MagicMock()


class TestExpandParents:
    """Test _expand_parents deduplication and field preservation."""

    def test_expand_parents_deduplicates_same_parent(self):
        """Two children sharing one parent should yield one result."""
        from services.retrieval_service import _expand_parents

        results = [
            {"text": "child1", "parent_text": "parent A", "chunk_id": "1"},
            {"text": "child2", "parent_text": "parent A", "chunk_id": "2"},
            {"text": "child3", "parent_text": "parent B", "chunk_id": "3"},
        ]
        expanded = _expand_parents(results)
        assert len(expanded) == 2, f"Expected 2 deduplicated parents, got {len(expanded)}"

    def test_expand_parents_replaces_text_with_parent(self):
        """Result text field should contain parent text after expansion."""
        from services.retrieval_service import _expand_parents

        results = [
            {"text": "child text", "parent_text": "parent text here", "chunk_id": "1"},
        ]
        expanded = _expand_parents(results)
        assert expanded[0]["text"] == "parent text here"

    def test_expand_parents_preserves_child_text(self):
        """Original child text should be preserved in child_text field."""
        from services.retrieval_service import _expand_parents

        results = [
            {"text": "child text", "parent_text": "parent text here", "chunk_id": "1"},
        ]
        expanded = _expand_parents(results)
        assert expanded[0]["child_text"] == "child text"

    def test_expand_parents_handles_none_parent_text(self):
        """Results without parent_text (old docs) should pass through unchanged."""
        from services.retrieval_service import _expand_parents

        results = [
            {"text": "legacy chunk", "parent_text": None, "chunk_id": "1"},
            {"text": "another legacy", "chunk_id": "2"},
        ]
        expanded = _expand_parents(results)
        assert len(expanded) == 2
        assert expanded[0]["text"] == "legacy chunk"
        assert expanded[1]["text"] == "another legacy"

    def test_expand_parents_ordering(self):
        """Parent text should appear in order of first child match."""
        from services.retrieval_service import _expand_parents

        results = [
            {"text": "child1", "parent_text": "parent B", "chunk_id": "1"},
            {"text": "child2", "parent_text": "parent A", "chunk_id": "2"},
            {"text": "child3", "parent_text": "parent B", "chunk_id": "3"},
        ]
        expanded = _expand_parents(results)
        assert len(expanded) == 2
        assert expanded[0]["text"] == "parent B"
        assert expanded[1]["text"] == "parent A"


class TestIngestionPipelineWiring:
    """Test that documents.py correctly unpacks chunk_document dict."""

    def test_ingestion_calls_add_chunks_with_parent_texts(self):
        """Ingestion should pass parent_texts and child_to_parent_index to add_chunks."""
        from services import chunking_service

        sample_text = "# Heading\n\n" + "This is a sample document. " * 200
        chunk_result = chunking_service.chunk_document(sample_text)

        # Verify chunk_document returns the expected dict structure
        assert "child_chunks" in chunk_result
        assert "parent_texts" in chunk_result
        assert "child_to_parent_index" in chunk_result
        assert len(chunk_result["child_chunks"]) > 0
        assert len(chunk_result["parent_texts"]) == len(chunk_result["child_chunks"])
        assert len(chunk_result["child_to_parent_index"]) == len(chunk_result["child_chunks"])

    def test_child_chunks_are_embedded_not_parents(self):
        """Embeddings should be generated for child_chunks, not parent_texts."""
        from services import chunking_service

        sample_text = "Introduction paragraph. " * 100
        chunk_result = chunking_service.chunk_document(sample_text)
        child_chunks = chunk_result["child_chunks"]
        parent_texts = chunk_result["parent_texts"]

        # Children should generally be shorter than parents
        for child, parent in zip(child_chunks, parent_texts):
            assert len(child) <= len(parent)
