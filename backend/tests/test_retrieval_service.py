"""
Tests for hybrid retrieval pipeline with RRF fusion and timeout-guarded reranking.

Mocks all dependent services: reranker_service, bm25_index_service,
embedding_service, vector_service.
"""

import unittest
from unittest.mock import patch, MagicMock
from concurrent.futures import TimeoutError as FuturesTimeoutError


def _make_dense_result(chunk_id, text="chunk text", doc_id="doc1",
                       filename="test.pdf", chunk_index=0, total_chunks=5,
                       distance=0.1):
    """Build a mock ChromaDB query result dict for a single chunk."""
    return {
        "text": text,
        "source_filename": filename,
        "source_doc_id": doc_id,
        "chunk_position": f"{chunk_index + 1}/{total_chunks}",
        "relevance_score": 1.0 / (1.0 + distance),
        "chunk_id": chunk_id,
    }


def _mock_chroma_results(items):
    """Build mock ChromaDB query() response from a list of item tuples.

    Each item: (chunk_id, text, doc_id, filename, chunk_index, total_chunks, distance)
    """
    ids = [[item[0] for item in items]]
    documents = [[item[1] for item in items]]
    metadatas = [[{
        "doc_id": item[2],
        "filename": item[3],
        "chunk_index": item[4],
        "total_chunks": item[5],
    } for item in items]]
    distances = [[item[6] for item in items]]
    return {
        "ids": ids,
        "documents": documents,
        "metadatas": metadatas,
        "distances": distances,
    }


class TestReciprocalRankFusion(unittest.TestCase):
    """Test RRF fusion logic independently."""

    def test_rrf_merges_two_ranked_lists(self):
        """RRF combines dense and BM25 results into a fused list."""
        from services.retrieval_service import reciprocal_rank_fusion

        dense_results = [
            _make_dense_result("doc1_chunk_0", text="A"),
            _make_dense_result("doc1_chunk_1", text="B"),
            _make_dense_result("doc1_chunk_2", text="C"),
        ]
        bm25_results = [
            {"chunk_id": "doc1_chunk_3", "bm25_score": 2.0},
            {"chunk_id": "doc1_chunk_1", "bm25_score": 1.5},
            {"chunk_id": "doc1_chunk_4", "bm25_score": 1.0},
        ]

        fused = reciprocal_rank_fusion(dense_results, bm25_results, k=60,
                                       dense_weight=1.0, bm25_weight=1.0)

        # Should contain all unique chunk_ids from both lists
        fused_ids = [r["chunk_id"] for r in fused]
        self.assertIn("doc1_chunk_0", fused_ids)
        self.assertIn("doc1_chunk_1", fused_ids)
        self.assertIn("doc1_chunk_2", fused_ids)
        self.assertIn("doc1_chunk_3", fused_ids)
        self.assertIn("doc1_chunk_4", fused_ids)

    def test_document_in_both_lists_scores_higher(self):
        """A document appearing in both dense and BM25 gets higher fused score."""
        from services.retrieval_service import reciprocal_rank_fusion

        # doc1_chunk_1 is in both lists
        dense_results = [
            _make_dense_result("doc1_chunk_0", text="A"),
            _make_dense_result("doc1_chunk_1", text="B"),
        ]
        bm25_results = [
            {"chunk_id": "doc1_chunk_1", "bm25_score": 2.0},
            {"chunk_id": "doc1_chunk_2", "bm25_score": 1.0},
        ]

        fused = reciprocal_rank_fusion(dense_results, bm25_results, k=60,
                                       dense_weight=1.0, bm25_weight=1.0)

        # chunk_1 is in both lists: rank 2 in dense + rank 1 in BM25
        # chunk_0 is dense-only: rank 1 in dense
        # chunk_2 is BM25-only: rank 2 in BM25
        scores = {r["chunk_id"]: r["fused_score"] for r in fused}
        self.assertGreater(scores["doc1_chunk_1"], scores["doc1_chunk_0"])
        self.assertGreater(scores["doc1_chunk_1"], scores["doc1_chunk_2"])

    def test_rrf_sets_rank_defaults(self):
        """Results have dense_rank and bm25_rank set, None if not present."""
        from services.retrieval_service import reciprocal_rank_fusion

        dense_results = [
            _make_dense_result("doc1_chunk_0", text="A"),
        ]
        bm25_results = [
            {"chunk_id": "doc1_chunk_1", "bm25_score": 1.5},
        ]

        fused = reciprocal_rank_fusion(dense_results, bm25_results, k=60,
                                       dense_weight=1.0, bm25_weight=1.0)

        for result in fused:
            if result["chunk_id"] == "doc1_chunk_0":
                self.assertEqual(result["dense_rank"], 1)
                self.assertIsNone(result["bm25_rank"])
            elif result["chunk_id"] == "doc1_chunk_1":
                self.assertIsNone(result["dense_rank"])
                self.assertEqual(result["bm25_rank"], 1)

    def test_rrf_sorted_descending(self):
        """Fused results are sorted by fused_score descending."""
        from services.retrieval_service import reciprocal_rank_fusion

        dense_results = [
            _make_dense_result("doc1_chunk_0", text="A"),
            _make_dense_result("doc1_chunk_1", text="B"),
        ]
        bm25_results = [
            {"chunk_id": "doc1_chunk_1", "bm25_score": 2.0},
        ]

        fused = reciprocal_rank_fusion(dense_results, bm25_results, k=60,
                                       dense_weight=1.0, bm25_weight=1.0)
        scores = [r["fused_score"] for r in fused]
        self.assertEqual(scores, sorted(scores, reverse=True))


class TestSearchDocuments(unittest.TestCase):
    """Test the full search_documents pipeline with mocked services."""

    @patch("services.retrieval_service.get_collection")
    @patch("services.retrieval_service.generate_embeddings")
    @patch("services.retrieval_service.bm25_index_service")
    @patch("services.retrieval_service.reranker_service")
    def test_reranker_timeout_falls_back_to_rrf_only(
        self, mock_reranker, mock_bm25, mock_embed, mock_collection
    ):
        """On reranker timeout, results have retrieval_method='rrf_only'."""
        from services.retrieval_service import search_documents

        mock_embed.return_value = [[0.1] * 768]

        chroma_items = [
            ("doc1_chunk_0", "text A", "doc1", "test.pdf", 0, 5, 0.1),
            ("doc1_chunk_1", "text B", "doc1", "test.pdf", 1, 5, 0.2),
        ]
        collection = MagicMock()
        collection.query.return_value = _mock_chroma_results(chroma_items)
        mock_collection.return_value = collection

        mock_bm25.search.return_value = [
            {"chunk_id": "doc1_chunk_2", "bm25_score": 1.5},
        ]

        # Simulate timeout
        mock_reranker.rerank.side_effect = Exception("simulated timeout")

        results = search_documents("test query")
        for result in results:
            self.assertEqual(result["retrieval_method"], "rrf_only")

    @patch("services.retrieval_service.get_collection")
    @patch("services.retrieval_service.generate_embeddings")
    @patch("services.retrieval_service.bm25_index_service")
    @patch("services.retrieval_service.reranker_service")
    def test_bm25_empty_falls_back_to_dense_only(
        self, mock_reranker, mock_bm25, mock_embed, mock_collection
    ):
        """When BM25 returns empty, uses dense-only path."""
        from services.retrieval_service import search_documents

        mock_embed.return_value = [[0.1] * 768]

        chroma_items = [
            ("doc1_chunk_0", "text A", "doc1", "test.pdf", 0, 5, 0.1),
            ("doc1_chunk_1", "text B", "doc1", "test.pdf", 1, 5, 0.2),
        ]
        collection = MagicMock()
        collection.query.return_value = _mock_chroma_results(chroma_items)
        mock_collection.return_value = collection

        mock_bm25.search.return_value = []

        mock_reranker.rerank.return_value = [
            {
                "text": "text A",
                "source_filename": "test.pdf",
                "source_doc_id": "doc1",
                "chunk_position": "1/5",
                "relevance_score": 0.91,
                "chunk_id": "doc1_chunk_0",
                "reranker_score": 0.95,
                "dense_rank": 1,
                "bm25_rank": None,
            }
        ]

        results = search_documents("test query")
        self.assertTrue(len(results) > 0)

    @patch("services.retrieval_service.get_collection")
    @patch("services.retrieval_service.generate_embeddings")
    @patch("services.retrieval_service.bm25_index_service")
    @patch("services.retrieval_service.reranker_service")
    def test_all_diagnostic_fields_present(
        self, mock_reranker, mock_bm25, mock_embed, mock_collection
    ):
        """All results have the diagnostic fields."""
        from services.retrieval_service import search_documents

        mock_embed.return_value = [[0.1] * 768]

        chroma_items = [
            ("doc1_chunk_0", "text A", "doc1", "test.pdf", 0, 5, 0.1),
        ]
        collection = MagicMock()
        collection.query.return_value = _mock_chroma_results(chroma_items)
        mock_collection.return_value = collection

        mock_bm25.search.return_value = []

        mock_reranker.rerank.return_value = [
            {
                "text": "text A",
                "source_filename": "test.pdf",
                "source_doc_id": "doc1",
                "chunk_position": "1/5",
                "relevance_score": 0.91,
                "chunk_id": "doc1_chunk_0",
                "reranker_score": 0.95,
                "dense_rank": 1,
                "bm25_rank": None,
            }
        ]

        results = search_documents("test query")
        required_fields = [
            "text", "source_filename", "source_doc_id", "chunk_position",
            "relevance_score", "reranker_score", "bm25_rank", "dense_rank",
            "retrieval_method"
        ]
        for result in results:
            for field in required_fields:
                self.assertIn(field, result, f"Missing field: {field}")

    @patch("services.retrieval_service.get_collection")
    @patch("services.retrieval_service.generate_embeddings")
    @patch("services.retrieval_service.bm25_index_service")
    @patch("services.retrieval_service.reranker_service")
    def test_successful_rerank_sets_method_reranked(
        self, mock_reranker, mock_bm25, mock_embed, mock_collection
    ):
        """On successful rerank, retrieval_method='reranked'."""
        from services.retrieval_service import search_documents

        mock_embed.return_value = [[0.1] * 768]

        chroma_items = [
            ("doc1_chunk_0", "text A", "doc1", "test.pdf", 0, 5, 0.1),
            ("doc1_chunk_1", "text B", "doc1", "test.pdf", 1, 5, 0.2),
        ]
        collection = MagicMock()
        collection.query.return_value = _mock_chroma_results(chroma_items)
        mock_collection.return_value = collection

        mock_bm25.search.return_value = [
            {"chunk_id": "doc1_chunk_0", "bm25_score": 2.0},
        ]

        mock_reranker.rerank.return_value = [
            {
                "text": "text A",
                "source_filename": "test.pdf",
                "source_doc_id": "doc1",
                "chunk_position": "1/5",
                "relevance_score": 0.91,
                "chunk_id": "doc1_chunk_0",
                "reranker_score": 0.95,
                "dense_rank": 1,
                "bm25_rank": 1,
                "fused_score": 0.03,
            }
        ]

        results = search_documents("test query")
        for result in results:
            self.assertEqual(result["retrieval_method"], "reranked")

    @patch("services.retrieval_service.get_collection")
    @patch("services.retrieval_service.generate_embeddings")
    @patch("services.retrieval_service.bm25_index_service")
    @patch("services.retrieval_service.reranker_service")
    def test_output_size_matches_config(
        self, mock_reranker, mock_bm25, mock_embed, mock_collection
    ):
        """Output size is capped at RERANK_OUTPUT_SIZE."""
        from services.retrieval_service import search_documents
        from config import RERANK_OUTPUT_SIZE

        mock_embed.return_value = [[0.1] * 768]

        # Provide more candidates than RERANK_OUTPUT_SIZE
        chroma_items = [
            (f"doc1_chunk_{i}", f"text {i}", "doc1", "test.pdf", i, 10, 0.1 * i)
            for i in range(10)
        ]
        collection = MagicMock()
        collection.query.return_value = _mock_chroma_results(chroma_items)
        mock_collection.return_value = collection

        mock_bm25.search.return_value = []

        # Reranker returns exactly RERANK_OUTPUT_SIZE results
        reranked_results = [
            {
                "text": f"text {i}",
                "source_filename": "test.pdf",
                "source_doc_id": "doc1",
                "chunk_position": f"{i + 1}/10",
                "relevance_score": 0.9 - (i * 0.1),
                "chunk_id": f"doc1_chunk_{i}",
                "reranker_score": 0.9 - (i * 0.1),
                "dense_rank": i + 1,
                "bm25_rank": None,
            }
            for i in range(RERANK_OUTPUT_SIZE)
        ]
        mock_reranker.rerank.return_value = reranked_results

        results = search_documents("test query")
        self.assertLessEqual(len(results), RERANK_OUTPUT_SIZE)


if __name__ == "__main__":
    unittest.main()
