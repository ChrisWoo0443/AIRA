"""
Tests for parent-text metadata storage in vector_service.add_chunks.

Validates that add_chunks accepts optional parent_texts and
child_to_parent_index parameters, stores parent_text in ChromaDB
metadata when provided, and remains backwards-compatible when omitted.
"""

import sys
from unittest.mock import MagicMock, patch

import pytest


# Ensure chromadb mock is set up before importing vector_service
if "chromadb" not in sys.modules:
    sys.modules["chromadb"] = MagicMock()
    sys.modules["chromadb.config"] = MagicMock()


class TestAddChunksParentMetadata:
    """Test add_chunks stores parent_text in ChromaDB metadata."""

    def test_add_chunks_accepts_parent_texts_parameter(self):
        """add_chunks should accept parent_texts keyword argument."""
        import importlib
        import inspect
        from services import vector_service

        importlib.reload(vector_service)
        sig = inspect.signature(vector_service.add_chunks)
        param_names = list(sig.parameters.keys())
        assert "parent_texts" in param_names, (
            f"add_chunks missing parent_texts param, got: {param_names}"
        )

    def test_add_chunks_accepts_child_to_parent_index_parameter(self):
        """add_chunks should accept child_to_parent_index keyword argument."""
        import importlib
        import inspect
        from services import vector_service

        importlib.reload(vector_service)
        sig = inspect.signature(vector_service.add_chunks)
        param_names = list(sig.parameters.keys())
        assert "child_to_parent_index" in param_names, (
            f"add_chunks missing child_to_parent_index param, got: {param_names}"
        )

    @patch("services.vector_service.get_collection")
    def test_parent_text_stored_in_metadata_when_provided(self, mock_get_collection):
        """When parent_texts provided, each metadata dict should have parent_text."""
        import importlib
        from services import vector_service

        importlib.reload(vector_service)

        mock_collection = MagicMock()
        mock_get_collection.return_value = mock_collection

        chunks = ["child 1", "child 2"]
        embeddings = [[0.1, 0.2], [0.3, 0.4]]
        parent_texts = ["parent A text", "parent A text"]
        child_to_parent_index = [0, 0]

        vector_service.add_chunks(
            doc_id="doc1",
            filename="test.pdf",
            chunks=chunks,
            embeddings=embeddings,
            parent_texts=parent_texts,
            child_to_parent_index=child_to_parent_index,
        )

        mock_collection.add.assert_called_once()
        call_kwargs = mock_collection.add.call_args
        metadatas = call_kwargs.kwargs.get("metadatas") or call_kwargs[1].get("metadatas")

        assert metadatas[0]["parent_text"] == "parent A text"
        assert metadatas[1]["parent_text"] == "parent A text"
        assert metadatas[0]["parent_chunk_index"] == 0
        assert metadatas[1]["parent_chunk_index"] == 0

    @patch("services.vector_service.get_collection")
    def test_no_parent_text_in_metadata_when_omitted(self, mock_get_collection):
        """Backwards compat: no parent_text key in metadata when not provided."""
        import importlib
        from services import vector_service

        importlib.reload(vector_service)

        mock_collection = MagicMock()
        mock_get_collection.return_value = mock_collection

        chunks = ["chunk 1"]
        embeddings = [[0.1, 0.2]]

        vector_service.add_chunks(
            doc_id="doc1",
            filename="test.pdf",
            chunks=chunks,
            embeddings=embeddings,
        )

        mock_collection.add.assert_called_once()
        call_kwargs = mock_collection.add.call_args
        metadatas = call_kwargs.kwargs.get("metadatas") or call_kwargs[1].get("metadatas")

        assert "parent_text" not in metadatas[0]
        assert "parent_chunk_index" not in metadatas[0]
