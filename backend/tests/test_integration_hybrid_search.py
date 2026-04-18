"""
Integration tests for the full hybrid search pipeline.

Tests broader behavior than unit tests: end-to-end search flow,
BM25 persistence across simulated restarts, document deletion cleanup,
RRF fusion correctness, reranker timeout fallback, config values, and
health endpoint component status.
"""

import os
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock


def _make_dense_result(chunk_id, text="chunk text", doc_id="doc1",
                       filename="test.pdf", chunk_index=0, total_chunks=5,
                       distance=0.1):
    """Build a result dict matching _query_dense output format."""
    return {
        "text": text,
        "source_filename": filename,
        "source_doc_id": doc_id,
        "chunk_position": f"{chunk_index + 1}/{total_chunks}",
        "relevance_score": 1.0 / (1.0 + distance),
        "chunk_id": chunk_id,
    }


def _mock_chroma_results(items):
    """Build mock ChromaDB query() response.

    Each item: (chunk_id, text, doc_id, filename, chunk_index, total_chunks, distance)
    """
    return {
        "ids": [[item[0] for item in items]],
        "documents": [[item[1] for item in items]],
        "metadatas": [[{
            "doc_id": item[2],
            "filename": item[3],
            "chunk_index": item[4],
            "total_chunks": item[5],
        } for item in items]],
        "distances": [[item[6] for item in items]],
    }


class TestHybridSearchDiagnosticFields(unittest.TestCase):
    """End-to-end: search_documents returns all diagnostic fields."""

    @patch("services.retrieval_service.get_collection")
    @patch("services.retrieval_service.generate_embeddings")
    @patch("services.retrieval_service.bm25_index_service")
    @patch("services.retrieval_service.reranker_service")
    def test_hybrid_search_returns_diagnostic_fields(
        self, mock_reranker, mock_bm25, mock_embed, mock_collection
    ):
        """search_documents returns results with all required diagnostic fields."""
        from services.retrieval_service import search_documents

        mock_embed.return_value = [[0.1] * 768]

        chroma_items = [
            ("doc1_chunk_0", "machine learning basics", "doc1", "ml.pdf", 0, 3, 0.1),
            ("doc1_chunk_1", "neural network architecture", "doc1", "ml.pdf", 1, 3, 0.2),
            ("doc1_chunk_2", "deep learning overview", "doc1", "ml.pdf", 2, 3, 0.3),
        ]
        collection = MagicMock()
        collection.query.return_value = _mock_chroma_results(chroma_items)
        mock_collection.return_value = collection

        mock_bm25.search.return_value = [
            {"chunk_id": "doc1_chunk_0", "bm25_score": 2.5},
            {"chunk_id": "doc1_chunk_2", "bm25_score": 1.0},
        ]

        mock_reranker.rerank.return_value = [
            {
                "text": "machine learning basics",
                "source_filename": "ml.pdf",
                "source_doc_id": "doc1",
                "chunk_position": "1/3",
                "relevance_score": 0.91,
                "chunk_id": "doc1_chunk_0",
                "reranker_score": 0.95,
                "dense_rank": 1,
                "bm25_rank": 1,
                "fused_score": 0.033,
            },
            {
                "text": "deep learning overview",
                "source_filename": "ml.pdf",
                "source_doc_id": "doc1",
                "chunk_position": "3/3",
                "relevance_score": 0.77,
                "chunk_id": "doc1_chunk_2",
                "reranker_score": 0.80,
                "dense_rank": 3,
                "bm25_rank": 2,
                "fused_score": 0.032,
            },
        ]

        results = search_documents("machine learning")

        self.assertTrue(len(results) > 0, "Expected non-empty results")

        required_fields = [
            "text", "source_filename", "source_doc_id", "chunk_position",
            "relevance_score", "reranker_score", "bm25_rank", "dense_rank",
            "retrieval_method"
        ]

        for result in results:
            for field in required_fields:
                self.assertIn(field, result, f"Missing field: {field}")
            self.assertEqual(result["retrieval_method"], "reranked")


class TestBM25Persistence(unittest.TestCase):
    """BM25 index persists across simulated restart (reload from disk)."""

    def test_bm25_persistence_survives_restart(self):
        """Add documents, persist, reset memory state, reload, verify results."""
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)

            with patch("services.bm25_index_service.BM25_DIR", tmp_path), \
                 patch("services.bm25_index_service.INDEX_PATH", tmp_path / "index.pkl"), \
                 patch("services.bm25_index_service.CORPUS_MAP_PATH", tmp_path / "corpus_map.json"):

                import services.bm25_index_service as bm25_svc

                # Reset to clean state
                bm25_svc._bm25 = None
                bm25_svc._tokenized_corpus = []
                bm25_svc._corpus_chunk_ids = []
                bm25_svc._doc_to_chunks = {}
                bm25_svc._loaded = True  # Skip initial load attempt

                # Add a document with known chunks
                bm25_svc.add_document(
                    "doc_persist",
                    ["quantum computing uses qubits", "entanglement enables teleportation"],
                    ["doc_persist_chunk_0", "doc_persist_chunk_1"]
                )

                # Verify search finds results before restart
                results_before = bm25_svc.search("quantum qubits")
                self.assertTrue(len(results_before) > 0, "Should find results before restart")
                chunk_ids_before = [r["chunk_id"] for r in results_before]
                self.assertIn("doc_persist_chunk_0", chunk_ids_before)

                # Simulate restart: reset all memory state
                bm25_svc._bm25 = None
                bm25_svc._tokenized_corpus = []
                bm25_svc._corpus_chunk_ids = []
                bm25_svc._doc_to_chunks = {}
                bm25_svc._loaded = False  # Force reload from disk

                # Search again -- should trigger reload from disk
                results_after = bm25_svc.search("quantum qubits")
                self.assertTrue(len(results_after) > 0, "Should find results after restart")
                chunk_ids_after = [r["chunk_id"] for r in results_after]
                self.assertIn("doc_persist_chunk_0", chunk_ids_after)


class TestBM25Delete(unittest.TestCase):
    """Document delete removes entries from BM25 index."""

    def test_bm25_delete_removes_stale_entries(self):
        """After removing doc_a, its chunks no longer appear in search."""
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)

            with patch("services.bm25_index_service.BM25_DIR", tmp_path), \
                 patch("services.bm25_index_service.INDEX_PATH", tmp_path / "index.pkl"), \
                 patch("services.bm25_index_service.CORPUS_MAP_PATH", tmp_path / "corpus_map.json"):

                import services.bm25_index_service as bm25_svc

                # Reset to clean state
                bm25_svc._bm25 = None
                bm25_svc._tokenized_corpus = []
                bm25_svc._corpus_chunk_ids = []
                bm25_svc._doc_to_chunks = {}
                bm25_svc._loaded = True

                # Add two documents with distinct text
                bm25_svc.add_document(
                    "doc_a",
                    ["photosynthesis converts sunlight into energy",
                     "chloroplasts contain chlorophyll pigments"],
                    ["doc_a_chunk_0", "doc_a_chunk_1"]
                )
                bm25_svc.add_document(
                    "doc_b",
                    ["gravitational waves from merging black holes",
                     "LIGO detector measures spacetime ripples"],
                    ["doc_b_chunk_0", "doc_b_chunk_1"]
                )

                # Verify doc_a appears in search
                results_a = bm25_svc.search("photosynthesis sunlight")
                chunk_ids_a = [r["chunk_id"] for r in results_a]
                self.assertIn("doc_a_chunk_0", chunk_ids_a)

                # Remove doc_a
                bm25_svc.remove_document("doc_a")

                # Verify doc_a no longer appears
                results_after_delete = bm25_svc.search("photosynthesis sunlight")
                chunk_ids_after = [r["chunk_id"] for r in results_after_delete]
                self.assertNotIn("doc_a_chunk_0", chunk_ids_after)
                self.assertNotIn("doc_a_chunk_1", chunk_ids_after)

                # Verify doc_b still appears
                results_b = bm25_svc.search("gravitational waves black holes")
                chunk_ids_b = [r["chunk_id"] for r in results_b]
                self.assertIn("doc_b_chunk_0", chunk_ids_b)


class TestRRFFusion(unittest.TestCase):
    """RRF fusion produces correct merged rankings."""

    def test_rrf_fusion_merges_rankings(self):
        """Document in both lists scores higher than single-list documents."""
        from services.retrieval_service import reciprocal_rank_fusion

        dense_results = [
            _make_dense_result("chunk_shared", text="shared content", chunk_index=0),
            _make_dense_result("chunk_dense_only", text="dense only", chunk_index=1),
        ]
        bm25_results = [
            {"chunk_id": "chunk_shared", "bm25_score": 2.0},
            {"chunk_id": "chunk_bm25_only", "bm25_score": 1.5},
        ]

        fused = reciprocal_rank_fusion(
            dense_results, bm25_results,
            k=60, dense_weight=1.0, bm25_weight=1.0
        )

        scores = {r["chunk_id"]: r["fused_score"] for r in fused}

        # Shared chunk must score higher than single-list chunks
        self.assertGreater(scores["chunk_shared"], scores["chunk_dense_only"])
        self.assertGreater(scores["chunk_shared"], scores.get("chunk_bm25_only", 0))

        # Verify dense_rank and bm25_rank are set correctly
        for result in fused:
            if result["chunk_id"] == "chunk_shared":
                self.assertEqual(result["dense_rank"], 1)
                self.assertEqual(result["bm25_rank"], 1)
            elif result["chunk_id"] == "chunk_dense_only":
                self.assertEqual(result["dense_rank"], 2)
                self.assertIsNone(result["bm25_rank"])


class TestRerankerTimeoutFallback(unittest.TestCase):
    """Reranker timeout triggers graceful fallback to RRF-only."""

    @patch("services.retrieval_service.get_collection")
    @patch("services.retrieval_service.generate_embeddings")
    @patch("services.retrieval_service.bm25_index_service")
    @patch("services.retrieval_service.reranker_service")
    def test_reranker_timeout_falls_back_to_rrf(
        self, mock_reranker, mock_bm25, mock_embed, mock_collection
    ):
        """On reranker exception, results are returned with retrieval_method='rrf_only'."""
        from services.retrieval_service import search_documents

        mock_embed.return_value = [[0.1] * 768]

        chroma_items = [
            ("doc1_chunk_0", "text about AI", "doc1", "ai.pdf", 0, 4, 0.1),
            ("doc1_chunk_1", "text about ML", "doc1", "ai.pdf", 1, 4, 0.2),
            ("doc1_chunk_2", "text about DL", "doc1", "ai.pdf", 2, 4, 0.3),
        ]
        collection = MagicMock()
        collection.query.return_value = _mock_chroma_results(chroma_items)
        mock_collection.return_value = collection

        mock_bm25.search.return_value = [
            {"chunk_id": "doc1_chunk_0", "bm25_score": 1.5},
        ]

        # Simulate reranker failure (timeout or any exception)
        mock_reranker.rerank.side_effect = Exception("reranker timeout simulation")

        results = search_documents("artificial intelligence")

        self.assertTrue(len(results) > 0, "Should return results even on timeout")
        for result in results:
            self.assertEqual(result["retrieval_method"], "rrf_only")


class TestConfigValues(unittest.TestCase):
    """Config values are honored by the pipeline."""

    def test_config_values_honored(self):
        """All retrieval config constants match expected defaults."""
        from config import (
            RERANKER_CANDIDATE_COUNT, RERANK_OUTPUT_SIZE,
            RERANKER_TIMEOUT_MS, RRF_K,
            RRF_DENSE_WEIGHT, RRF_BM25_WEIGHT
        )

        self.assertEqual(RERANKER_CANDIDATE_COUNT, 30)
        self.assertEqual(RERANK_OUTPUT_SIZE, 5)
        self.assertEqual(RRF_K, 60)
        self.assertEqual(RERANKER_TIMEOUT_MS, 200)
        self.assertEqual(RRF_DENSE_WEIGHT, 1.0)
        self.assertEqual(RRF_BM25_WEIGHT, 1.0)


class TestHealthEndpoint(unittest.TestCase):
    """Health endpoint returns component status keys."""

    def test_health_endpoint_returns_component_status(self):
        """GET /health returns components with reranker and bm25 status."""
        from fastapi.testclient import TestClient
        from main import app

        client = TestClient(app)
        response = client.get("/health")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("components", data)

        components = data["components"]
        self.assertIn("reranker", components)
        self.assertIn("bm25", components)

        valid_reranker_statuses = {"unavailable", "loading", "ready"}
        valid_bm25_statuses = {"empty", "ready"}
        self.assertIn(components["reranker"], valid_reranker_statuses)
        self.assertIn(components["bm25"], valid_bm25_statuses)


if __name__ == "__main__":
    unittest.main()
