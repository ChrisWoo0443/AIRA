"""
Unit tests for query rewriting integration in rag_service.

Verifies that rag_service calls rewrite_query before search_documents
when QUERY_REWRITING_ENABLED is True and conversation_history is non-empty,
and that it falls back gracefully on exceptions or when disabled.
"""

import asyncio
import unittest
from dataclasses import dataclass, field
from typing import Optional
from unittest.mock import patch, MagicMock, AsyncMock


# Build a mock RewriteResult matching the real dataclass
@dataclass
class MockRewriteResult:
    original_query: str
    effective_query: str
    query_type: str
    rewritten_query: Optional[str] = None
    hyde_passage: Optional[str] = None
    hyde_embedding: Optional[list] = field(default=None)
    confidence_score: Optional[float] = None
    used_fallback: bool = False


def _make_search_results():
    """Build minimal search results for mocking search_documents."""
    return [
        {
            "text": "some chunk text",
            "source_filename": "test.pdf",
            "source_doc_id": "doc1",
            "chunk_position": "1/3",
            "relevance_score": 0.9,
        }
    ]


def _run_async(coro):
    """Helper to run async generators and collect all yielded values."""
    async def _collect():
        results = []
        async for chunk in coro:
            results.append(chunk)
        return results
    return asyncio.get_event_loop().run_until_complete(_collect())


class TestRagServiceRewriteWiring(unittest.TestCase):
    """Tests for query rewriting wiring in rag_service.generate_rag_response."""

    @patch("services.rag_service.stream_chat_completion")
    @patch("services.rag_service.search_documents")
    @patch("services.rag_service.rewrite_query")
    @patch("services.rag_service.QUERY_REWRITING_ENABLED", True)
    def test_calls_rewrite_when_enabled_with_history(
        self, mock_rewrite, mock_search, mock_stream
    ):
        """When enabled and history exists, rewrite_query is called."""
        from services.rag_service import generate_rag_response

        mock_rewrite.return_value = MockRewriteResult(
            original_query="what about costs?",
            effective_query="What are the costs of solar panel installation?",
            query_type="follow_up",
            rewritten_query="What are the costs of solar panel installation?",
        )
        mock_search.return_value = _make_search_results()
        mock_stream.return_value = _async_gen(["response"])

        history = [{"role": "user", "content": "Tell me about solar panels"}]
        _run_async(generate_rag_response("what about costs?", history))

        mock_rewrite.assert_called_once_with("what about costs?", history)

    @patch("services.rag_service.stream_chat_completion")
    @patch("services.rag_service.search_documents")
    @patch("services.rag_service.rewrite_query")
    @patch("services.rag_service.QUERY_REWRITING_ENABLED", True)
    def test_uses_effective_query_for_search(
        self, mock_rewrite, mock_search, mock_stream
    ):
        """search_documents receives effective_query from RewriteResult."""
        from services.rag_service import generate_rag_response

        mock_rewrite.return_value = MockRewriteResult(
            original_query="what about costs?",
            effective_query="What are the costs of solar panel installation?",
            query_type="follow_up",
        )
        mock_search.return_value = _make_search_results()
        mock_stream.return_value = _async_gen(["response"])

        history = [{"role": "user", "content": "Tell me about solar panels"}]
        _run_async(generate_rag_response("what about costs?", history))

        call_args = mock_search.call_args
        self.assertEqual(
            call_args[0][0],
            "What are the costs of solar panel installation?",
        )

    @patch("services.rag_service.stream_chat_completion")
    @patch("services.rag_service.search_documents")
    @patch("services.rag_service.rewrite_query")
    @patch("services.rag_service.QUERY_REWRITING_ENABLED", True)
    def test_passes_hyde_embedding_to_search(
        self, mock_rewrite, mock_search, mock_stream
    ):
        """When hyde_embedding is present, it is passed to search_documents."""
        from services.rag_service import generate_rag_response

        hyde_embedding = [0.1, 0.2, 0.3] * 100
        mock_rewrite.return_value = MockRewriteResult(
            original_query="approaches to concurrency",
            effective_query="approaches to concurrency",
            query_type="abstract",
            hyde_embedding=hyde_embedding,
        )
        mock_search.return_value = _make_search_results()
        mock_stream.return_value = _async_gen(["response"])

        history = [{"role": "user", "content": "previous message"}]
        _run_async(generate_rag_response("approaches to concurrency", history))

        call_kwargs = mock_search.call_args[1]
        self.assertEqual(call_kwargs["query_embedding"], hyde_embedding)

    @patch("services.rag_service.stream_chat_completion")
    @patch("services.rag_service.search_documents")
    @patch("services.rag_service.rewrite_query")
    @patch("services.rag_service.QUERY_REWRITING_ENABLED", True)
    def test_skips_rewrite_when_history_empty(
        self, mock_rewrite, mock_search, mock_stream
    ):
        """When conversation_history is empty, rewrite_query is NOT called."""
        from services.rag_service import generate_rag_response

        mock_search.return_value = _make_search_results()
        mock_stream.return_value = _async_gen(["response"])

        _run_async(generate_rag_response("What is machine learning?", []))

        mock_rewrite.assert_not_called()

    @patch("services.rag_service.stream_chat_completion")
    @patch("services.rag_service.search_documents")
    @patch("services.rag_service.rewrite_query")
    @patch("services.rag_service.QUERY_REWRITING_ENABLED", False)
    def test_skips_rewrite_when_disabled(
        self, mock_rewrite, mock_search, mock_stream
    ):
        """When QUERY_REWRITING_ENABLED is False, rewrite_query is NOT called."""
        from services.rag_service import generate_rag_response

        mock_search.return_value = _make_search_results()
        mock_stream.return_value = _async_gen(["response"])

        history = [{"role": "user", "content": "previous message"}]
        _run_async(generate_rag_response("what about costs?", history))

        mock_rewrite.assert_not_called()
        # search_documents should receive the original query
        call_args = mock_search.call_args
        self.assertEqual(call_args[0][0], "what about costs?")

    @patch("services.rag_service.stream_chat_completion")
    @patch("services.rag_service.search_documents")
    @patch("services.rag_service.rewrite_query")
    @patch("services.rag_service.QUERY_REWRITING_ENABLED", True)
    def test_falls_back_on_rewrite_exception(
        self, mock_rewrite, mock_search, mock_stream
    ):
        """When rewrite_query raises, search proceeds with original query."""
        from services.rag_service import generate_rag_response

        mock_rewrite.side_effect = RuntimeError("LLM timeout")
        mock_search.return_value = _make_search_results()
        mock_stream.return_value = _async_gen(["response"])

        history = [{"role": "user", "content": "previous message"}]
        _run_async(generate_rag_response("what about costs?", history))

        # Should have called search with original query
        call_args = mock_search.call_args
        self.assertEqual(call_args[0][0], "what about costs?")

    @patch("services.rag_service.stream_chat_completion")
    @patch("services.rag_service.search_documents")
    @patch("services.rag_service.rewrite_query")
    @patch("services.rag_service.QUERY_REWRITING_ENABLED", True)
    def test_original_query_used_for_llm_prompt(
        self, mock_rewrite, mock_search, mock_stream
    ):
        """The user message in the LLM prompt uses the original query, not rewritten."""
        from services.rag_service import generate_rag_response

        mock_rewrite.return_value = MockRewriteResult(
            original_query="what about costs?",
            effective_query="What are the costs of solar panel installation?",
            query_type="follow_up",
        )
        mock_search.return_value = _make_search_results()
        mock_stream.return_value = _async_gen(["response"])

        history = [{"role": "user", "content": "Tell me about solar panels"}]
        _run_async(generate_rag_response("what about costs?", history))

        # The last message passed to stream_chat_completion should be the user's original query
        call_args = mock_stream.call_args
        messages = call_args[0][0]
        user_message = messages[-1]
        self.assertEqual(user_message["role"], "user")
        self.assertEqual(user_message["content"], "what about costs?")


class TestRetrievalServiceQueryEmbedding(unittest.TestCase):
    """Tests for query_embedding parameter in search_documents."""

    @patch("services.retrieval_service._expand_parents", side_effect=lambda x: x)
    @patch("services.retrieval_service.reranker_service")
    @patch("services.retrieval_service.bm25_index_service")
    @patch("services.retrieval_service.get_collection")
    @patch("services.retrieval_service.generate_embeddings")
    def test_uses_provided_embedding_skips_generate(
        self, mock_embed, mock_collection, mock_bm25, mock_reranker, mock_parents
    ):
        """When query_embedding is provided, generate_embeddings is NOT called."""
        from services.retrieval_service import search_documents

        provided_embedding = [0.5] * 1024
        collection = MagicMock()
        collection.query.return_value = {
            "ids": [["chunk1"]],
            "documents": [["text"]],
            "metadatas": [[{"doc_id": "d1", "filename": "f.pdf", "chunk_index": 0, "total_chunks": 1}]],
            "distances": [[0.1]],
        }
        mock_collection.return_value = collection
        mock_bm25.search.return_value = []
        mock_reranker.rerank.return_value = [{
            "text": "text", "source_filename": "f.pdf", "source_doc_id": "d1",
            "chunk_position": "1/1", "relevance_score": 0.9, "chunk_id": "chunk1",
            "reranker_score": 0.9,
        }]

        search_documents("test query", query_embedding=provided_embedding)

        mock_embed.assert_not_called()
        # Verify the provided embedding was passed to ChromaDB query
        query_call = collection.query.call_args
        self.assertEqual(query_call[1]["query_embeddings"], [provided_embedding])

    @patch("services.retrieval_service._expand_parents", side_effect=lambda x: x)
    @patch("services.retrieval_service.reranker_service")
    @patch("services.retrieval_service.bm25_index_service")
    @patch("services.retrieval_service.get_collection")
    @patch("services.retrieval_service.generate_embeddings")
    def test_generates_embedding_when_not_provided(
        self, mock_embed, mock_collection, mock_bm25, mock_reranker, mock_parents
    ):
        """When query_embedding is None (default), generate_embeddings IS called."""
        from services.retrieval_service import search_documents

        mock_embed.return_value = [[0.1] * 1024]
        collection = MagicMock()
        collection.query.return_value = {
            "ids": [["chunk1"]],
            "documents": [["text"]],
            "metadatas": [[{"doc_id": "d1", "filename": "f.pdf", "chunk_index": 0, "total_chunks": 1}]],
            "distances": [[0.1]],
        }
        mock_collection.return_value = collection
        mock_bm25.search.return_value = []
        mock_reranker.rerank.return_value = [{
            "text": "text", "source_filename": "f.pdf", "source_doc_id": "d1",
            "chunk_position": "1/1", "relevance_score": 0.9, "chunk_id": "chunk1",
            "reranker_score": 0.9,
        }]

        search_documents("test query")

        mock_embed.assert_called_once_with(["test query"])


async def _async_gen(items):
    """Create an async generator yielding items."""
    for item in items:
        yield item


if __name__ == "__main__":
    unittest.main()
