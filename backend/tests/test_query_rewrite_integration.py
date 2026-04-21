"""
Integration tests for the query rewrite pipeline.

Tests the full flow from rag_service.generate_rag_response through
query_rewrite_service to retrieval_service.search_documents, verifying
that classification, rewriting, HyDE, confidence gating, config gating,
and exception fallback all work end-to-end.

Mocks at external boundaries: Ollama (LLM/embedding), ChromaDB, BM25, reranker.
"""

import asyncio
import json
import unittest
from unittest.mock import patch, MagicMock


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_search_results():
    """Build minimal search results for downstream mocking."""
    return [
        {
            "text": "some relevant chunk text",
            "source_filename": "test.pdf",
            "source_doc_id": "doc1",
            "chunk_position": "1/3",
            "relevance_score": 0.9,
        }
    ]


async def _async_gen(items):
    """Create an async generator yielding items."""
    for item in items:
        yield item


def _run_rag(query, history):
    """Run generate_rag_response synchronously, collecting all yields."""
    from services.rag_service import generate_rag_response

    async def _collect():
        results = []
        async for chunk in generate_rag_response(query, history):
            results.append(chunk)
        return results

    return asyncio.get_event_loop().run_until_complete(_collect())


def _classification_response(query_type: str, reasoning: str = "test") -> dict:
    """Build an Ollama chat response for query classification."""
    return {
        "message": {
            "content": json.dumps({
                "query_type": query_type,
                "reasoning": reasoning,
            })
        }
    }


def _text_response(text: str) -> dict:
    """Build an Ollama chat response for plain text (rewrite/HyDE)."""
    return {"message": {"content": text}}


# ---------------------------------------------------------------------------
# Integration tests
# ---------------------------------------------------------------------------

class TestQueryRewritePipeline(unittest.TestCase):
    """Integration tests for the full rewrite-to-search pipeline."""

    @patch("services.rag_service.stream_chat_completion")
    @patch("services.retrieval_service._expand_parents", side_effect=lambda x: x)
    @patch("services.retrieval_service.reranker_service")
    @patch("services.retrieval_service.bm25_index_service")
    @patch("services.retrieval_service.get_collection")
    @patch("services.retrieval_service.generate_embeddings")
    @patch("services.query_rewrite_service.ollama")
    @patch("services.rag_service.QUERY_REWRITING_ENABLED", True)
    def test_empty_history_skips_rewriting(
        self, mock_ollama, mock_embed, mock_collection, mock_bm25,
        mock_reranker, mock_parents, mock_stream
    ):
        """With empty history, rewrite_query is not called; search uses original query."""
        mock_embed.return_value = [[0.1] * 1024]
        collection = MagicMock()
        collection.query.return_value = {
            "ids": [["c1"]], "documents": [["text"]],
            "metadatas": [[{"doc_id": "d1", "filename": "f.pdf", "chunk_index": 0, "total_chunks": 1}]],
            "distances": [[0.1]],
        }
        mock_collection.return_value = collection
        mock_bm25.search.return_value = []
        mock_reranker.rerank.return_value = [{
            "text": "text", "source_filename": "f.pdf", "source_doc_id": "d1",
            "chunk_position": "1/1", "relevance_score": 0.9, "chunk_id": "c1",
            "reranker_score": 0.9,
        }]
        mock_stream.return_value = _async_gen(["response"])

        _run_rag("What is machine learning?", [])

        # Ollama should NOT be called for classification (no history)
        mock_ollama.chat.assert_not_called()
        # generate_embeddings IS called (for search, not rewrite)
        mock_embed.assert_called_once_with(["What is machine learning?"])

    @patch("services.rag_service.stream_chat_completion")
    @patch("services.retrieval_service._expand_parents", side_effect=lambda x: x)
    @patch("services.retrieval_service.reranker_service")
    @patch("services.retrieval_service.bm25_index_service")
    @patch("services.retrieval_service.get_collection")
    @patch("services.retrieval_service.generate_embeddings")
    @patch("services.query_rewrite_service.ollama")
    @patch("services.query_rewrite_service.generate_embeddings")
    @patch("services.rag_service.QUERY_REWRITING_ENABLED", True)
    def test_standalone_classification_passes_through(
        self, mock_rewrite_embed, mock_ollama, mock_retrieval_embed,
        mock_collection, mock_bm25, mock_reranker, mock_parents, mock_stream
    ):
        """Standalone-classified query passes through without rewriting."""
        # Classification returns standalone
        mock_ollama.chat.return_value = _classification_response("standalone")

        mock_retrieval_embed.return_value = [[0.1] * 1024]
        collection = MagicMock()
        collection.query.return_value = {
            "ids": [["c1"]], "documents": [["text"]],
            "metadatas": [[{"doc_id": "d1", "filename": "f.pdf", "chunk_index": 0, "total_chunks": 1}]],
            "distances": [[0.1]],
        }
        mock_collection.return_value = collection
        mock_bm25.search.return_value = []
        mock_reranker.rerank.return_value = [{
            "text": "text", "source_filename": "f.pdf", "source_doc_id": "d1",
            "chunk_position": "1/1", "relevance_score": 0.9, "chunk_id": "c1",
            "reranker_score": 0.9,
        }]
        mock_stream.return_value = _async_gen(["response"])

        history = [{"role": "user", "content": "previous msg"}]
        _run_rag("What is machine learning?", history)

        # Ollama called once for classification, not for rewrite
        self.assertEqual(mock_ollama.chat.call_count, 1)
        # search_documents called with original query
        mock_retrieval_embed.assert_called_once_with(["What is machine learning?"])

    @patch("services.rag_service.stream_chat_completion")
    @patch("services.retrieval_service._expand_parents", side_effect=lambda x: x)
    @patch("services.retrieval_service.reranker_service")
    @patch("services.retrieval_service.bm25_index_service")
    @patch("services.retrieval_service.get_collection")
    @patch("services.retrieval_service.generate_embeddings")
    @patch("services.query_rewrite_service.generate_embeddings")
    @patch("services.query_rewrite_service.ollama")
    @patch("services.rag_service.QUERY_REWRITING_ENABLED", True)
    def test_followup_rewritten_and_passes_gate(
        self, mock_ollama, mock_rewrite_embed, mock_retrieval_embed,
        mock_collection, mock_bm25, mock_reranker, mock_parents, mock_stream
    ):
        """Follow-up query gets rewritten; confidence gate passes; search uses rewritten query."""
        # First call: classification -> follow_up
        # Second call: rewrite -> standalone query
        mock_ollama.chat.side_effect = [
            _classification_response("follow_up"),
            _text_response("What are the costs of solar panel installation?"),
        ]

        # Confidence gate embeddings: high similarity (passes gate)
        # Two calls: one for original, one for rewritten
        high_sim_vec_a = [1.0, 0.0, 0.0]
        high_sim_vec_b = [0.9, 0.1, 0.0]
        mock_rewrite_embed.side_effect = [
            [high_sim_vec_a],  # original query embedding
            [high_sim_vec_b],  # rewritten query embedding
        ]

        mock_retrieval_embed.return_value = [[0.1] * 1024]
        collection = MagicMock()
        collection.query.return_value = {
            "ids": [["c1"]], "documents": [["text"]],
            "metadatas": [[{"doc_id": "d1", "filename": "f.pdf", "chunk_index": 0, "total_chunks": 1}]],
            "distances": [[0.1]],
        }
        mock_collection.return_value = collection
        mock_bm25.search.return_value = []
        mock_reranker.rerank.return_value = [{
            "text": "text", "source_filename": "f.pdf", "source_doc_id": "d1",
            "chunk_position": "1/1", "relevance_score": 0.9, "chunk_id": "c1",
            "reranker_score": 0.9,
        }]
        mock_stream.return_value = _async_gen(["response"])

        history = [{"role": "user", "content": "Tell me about solar panels"}]
        _run_rag("what about the costs?", history)

        # search_documents should have been called with the rewritten query
        mock_retrieval_embed.assert_called_once_with(
            ["What are the costs of solar panel installation?"]
        )

    @patch("services.rag_service.stream_chat_completion")
    @patch("services.retrieval_service._expand_parents", side_effect=lambda x: x)
    @patch("services.retrieval_service.reranker_service")
    @patch("services.retrieval_service.bm25_index_service")
    @patch("services.retrieval_service.get_collection")
    @patch("services.retrieval_service.generate_embeddings")
    @patch("services.query_rewrite_service.generate_embeddings")
    @patch("services.query_rewrite_service.ollama")
    @patch("services.rag_service.QUERY_REWRITING_ENABLED", True)
    def test_followup_rewrite_fails_gate(
        self, mock_ollama, mock_rewrite_embed, mock_retrieval_embed,
        mock_collection, mock_bm25, mock_reranker, mock_parents, mock_stream
    ):
        """Follow-up rewrite with low confidence falls back to original query."""
        mock_ollama.chat.side_effect = [
            _classification_response("follow_up"),
            _text_response("Completely unrelated topic about cooking"),
        ]

        # Confidence gate: low similarity (fails gate -> fallback to original)
        low_sim_vec_a = [1.0, 0.0, 0.0]
        low_sim_vec_b = [0.0, 0.0, 1.0]  # orthogonal = 0 similarity
        mock_rewrite_embed.side_effect = [
            [low_sim_vec_a],  # original query embedding
            [low_sim_vec_b],  # rewritten query embedding
        ]

        mock_retrieval_embed.return_value = [[0.1] * 1024]
        collection = MagicMock()
        collection.query.return_value = {
            "ids": [["c1"]], "documents": [["text"]],
            "metadatas": [[{"doc_id": "d1", "filename": "f.pdf", "chunk_index": 0, "total_chunks": 1}]],
            "distances": [[0.1]],
        }
        mock_collection.return_value = collection
        mock_bm25.search.return_value = []
        mock_reranker.rerank.return_value = [{
            "text": "text", "source_filename": "f.pdf", "source_doc_id": "d1",
            "chunk_position": "1/1", "relevance_score": 0.9, "chunk_id": "c1",
            "reranker_score": 0.9,
        }]
        mock_stream.return_value = _async_gen(["response"])

        history = [{"role": "user", "content": "Tell me about solar panels"}]
        _run_rag("what about the costs?", history)

        # search_documents receives original query (gate rejected rewrite)
        mock_retrieval_embed.assert_called_once_with(["what about the costs?"])

    @patch("services.rag_service.stream_chat_completion")
    @patch("services.retrieval_service._expand_parents", side_effect=lambda x: x)
    @patch("services.retrieval_service.reranker_service")
    @patch("services.retrieval_service.bm25_index_service")
    @patch("services.retrieval_service.get_collection")
    @patch("services.retrieval_service.generate_embeddings")
    @patch("services.query_rewrite_service.generate_embeddings")
    @patch("services.query_rewrite_service.ollama")
    @patch("services.rag_service.QUERY_REWRITING_ENABLED", True)
    def test_abstract_uses_hyde_embedding(
        self, mock_ollama, mock_rewrite_embed, mock_retrieval_embed,
        mock_collection, mock_bm25, mock_reranker, mock_parents, mock_stream
    ):
        """Abstract query generates HyDE passage; search receives hyde_embedding."""
        # Classification -> abstract, then HyDE passage generation
        mock_ollama.chat.side_effect = [
            _classification_response("abstract"),
            _text_response("Concurrent access patterns include mutex locks and semaphores."),
        ]

        # Confidence gate: high similarity for HyDE
        hyde_sim_vec_a = [1.0, 0.5, 0.0]
        hyde_sim_vec_b = [0.8, 0.6, 0.0]  # similar enough
        hyde_passage_embedding = [0.42] * 1024

        mock_rewrite_embed.side_effect = [
            [hyde_sim_vec_a],         # original query embedding (confidence gate)
            [hyde_sim_vec_b],         # HyDE passage embedding (confidence gate)
            [hyde_passage_embedding],  # HyDE passage embedding (for search)
        ]

        # search_documents should NOT call generate_embeddings because
        # query_embedding is provided (the HyDE embedding)
        collection = MagicMock()
        collection.query.return_value = {
            "ids": [["c1"]], "documents": [["text"]],
            "metadatas": [[{"doc_id": "d1", "filename": "f.pdf", "chunk_index": 0, "total_chunks": 1}]],
            "distances": [[0.1]],
        }
        mock_collection.return_value = collection
        mock_bm25.search.return_value = []
        mock_reranker.rerank.return_value = [{
            "text": "text", "source_filename": "f.pdf", "source_doc_id": "d1",
            "chunk_position": "1/1", "relevance_score": 0.9, "chunk_id": "c1",
            "reranker_score": 0.9,
        }]
        mock_stream.return_value = _async_gen(["response"])

        history = [{"role": "user", "content": "previous msg"}]
        _run_rag("What approaches exist for handling concurrent access?", history)

        # retrieval_service.generate_embeddings should NOT be called (HyDE embedding used)
        mock_retrieval_embed.assert_not_called()

        # ChromaDB query should receive the HyDE embedding
        query_call = collection.query.call_args
        self.assertEqual(query_call[1]["query_embeddings"], [hyde_passage_embedding])

    @patch("services.rag_service.stream_chat_completion")
    @patch("services.retrieval_service._expand_parents", side_effect=lambda x: x)
    @patch("services.retrieval_service.reranker_service")
    @patch("services.retrieval_service.bm25_index_service")
    @patch("services.retrieval_service.get_collection")
    @patch("services.retrieval_service.generate_embeddings")
    @patch("services.query_rewrite_service.ollama")
    @patch("services.rag_service.QUERY_REWRITING_ENABLED", False)
    def test_rewriting_disabled_skips_all(
        self, mock_ollama, mock_retrieval_embed, mock_collection,
        mock_bm25, mock_reranker, mock_parents, mock_stream
    ):
        """When QUERY_REWRITING_ENABLED=False, no rewriting occurs at all."""
        mock_retrieval_embed.return_value = [[0.1] * 1024]
        collection = MagicMock()
        collection.query.return_value = {
            "ids": [["c1"]], "documents": [["text"]],
            "metadatas": [[{"doc_id": "d1", "filename": "f.pdf", "chunk_index": 0, "total_chunks": 1}]],
            "distances": [[0.1]],
        }
        mock_collection.return_value = collection
        mock_bm25.search.return_value = []
        mock_reranker.rerank.return_value = [{
            "text": "text", "source_filename": "f.pdf", "source_doc_id": "d1",
            "chunk_position": "1/1", "relevance_score": 0.9, "chunk_id": "c1",
            "reranker_score": 0.9,
        }]
        mock_stream.return_value = _async_gen(["response"])

        history = [{"role": "user", "content": "previous msg"}]
        _run_rag("what about the costs?", history)

        # Ollama should NOT be called for classification/rewriting
        mock_ollama.chat.assert_not_called()
        # search_documents receives original query
        mock_retrieval_embed.assert_called_once_with(["what about the costs?"])

    @patch("services.rag_service.stream_chat_completion")
    @patch("services.retrieval_service._expand_parents", side_effect=lambda x: x)
    @patch("services.retrieval_service.reranker_service")
    @patch("services.retrieval_service.bm25_index_service")
    @patch("services.retrieval_service.get_collection")
    @patch("services.retrieval_service.generate_embeddings")
    @patch("services.rag_service.rewrite_query")
    @patch("services.rag_service.QUERY_REWRITING_ENABLED", True)
    def test_rewrite_exception_falls_back(
        self, mock_rewrite, mock_retrieval_embed, mock_collection,
        mock_bm25, mock_reranker, mock_parents, mock_stream
    ):
        """When rewrite_query raises, search proceeds with original query."""
        mock_rewrite.side_effect = RuntimeError("Ollama connection refused")

        mock_retrieval_embed.return_value = [[0.1] * 1024]
        collection = MagicMock()
        collection.query.return_value = {
            "ids": [["c1"]], "documents": [["text"]],
            "metadatas": [[{"doc_id": "d1", "filename": "f.pdf", "chunk_index": 0, "total_chunks": 1}]],
            "distances": [[0.1]],
        }
        mock_collection.return_value = collection
        mock_bm25.search.return_value = []
        mock_reranker.rerank.return_value = [{
            "text": "text", "source_filename": "f.pdf", "source_doc_id": "d1",
            "chunk_position": "1/1", "relevance_score": 0.9, "chunk_id": "c1",
            "reranker_score": 0.9,
        }]
        mock_stream.return_value = _async_gen(["response"])

        history = [{"role": "user", "content": "previous msg"}]
        # Should NOT raise -- exception caught internally
        results = _run_rag("what about the costs?", history)

        # search_documents receives original query
        mock_retrieval_embed.assert_called_once_with(["what about the costs?"])
        # We got a response (no exception propagated)
        self.assertTrue(len(results) > 0)


if __name__ == "__main__":
    unittest.main()
