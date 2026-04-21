"""
Unit tests for the query rewrite service.

Tests cover: classification, rewriting, HyDE generation, confidence gate,
the main rewrite_query orchestrator, and helper functions.
"""

import json
import math
from unittest.mock import patch, MagicMock

import pytest

# Import after conftest mocks external deps
from services.query_rewrite_service import (
    classify_query,
    rewrite_followup,
    generate_hyde_passage,
    confidence_gate,
    rewrite_query,
    _format_history,
    _cosine_similarity,
    QueryType,
    QueryClassification,
    RewriteResult,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_history():
    """Conversation history with 4 messages (2 turns)."""
    return [
        {"role": "user", "content": "What is machine learning?"},
        {"role": "assistant", "content": "Machine learning is a subset of AI..."},
        {"role": "user", "content": "How does supervised learning differ?"},
        {"role": "assistant", "content": "Supervised learning uses labeled data..."},
    ]


@pytest.fixture
def long_history():
    """Conversation history with 10 messages (5 turns)."""
    history = []
    for i in range(5):
        history.append({"role": "user", "content": f"User message {i + 1}"})
        history.append({"role": "assistant", "content": f"Assistant response {i + 1}"})
    return history


# ---------------------------------------------------------------------------
# TestClassifyQuery
# ---------------------------------------------------------------------------

class TestClassifyQuery:
    """Tests for classify_query function."""

    def test_empty_history_returns_standalone(self):
        """No history means standalone -- no Ollama call needed."""
        result = classify_query("What is Python?", [])

        assert result.query_type == QueryType.standalone
        assert "first" in result.reasoning.lower() or "no" in result.reasoning.lower()

    @patch("services.query_rewrite_service.ollama")
    def test_successful_classification(self, mock_ollama, sample_history):
        """Ollama returns valid structured output parsed into QueryClassification."""
        classification_json = json.dumps({
            "query_type": "follow_up",
            "reasoning": "References previous discussion with 'it'",
        })
        mock_ollama.chat.return_value = {
            "message": {"content": classification_json}
        }

        result = classify_query("What about it?", sample_history)

        assert result.query_type == QueryType.follow_up
        assert "it" in result.reasoning.lower()
        mock_ollama.chat.assert_called_once()
        call_kwargs = mock_ollama.chat.call_args
        assert "format" in call_kwargs.kwargs or "format" in (call_kwargs[1] if len(call_kwargs) > 1 else {})

    @patch("services.query_rewrite_service.ollama")
    def test_ollama_failure_returns_standalone(self, mock_ollama, sample_history):
        """On Ollama error, fall back to standalone (safe default)."""
        mock_ollama.chat.side_effect = Exception("Connection refused")

        result = classify_query("Tell me more", sample_history)

        assert result.query_type == QueryType.standalone
        assert result.reasoning != ""


# ---------------------------------------------------------------------------
# TestRewriteFollowup
# ---------------------------------------------------------------------------

class TestRewriteFollowup:
    """Tests for rewrite_followup function."""

    @patch("services.query_rewrite_service.ollama")
    def test_successful_rewrite(self, mock_ollama, sample_history):
        """Ollama rewrites the follow-up query into standalone form."""
        mock_ollama.chat.return_value = {
            "message": {"content": "How does supervised learning differ from unsupervised learning?"}
        }

        result = rewrite_followup("How does it differ?", sample_history)

        assert "supervised" in result.lower()
        mock_ollama.chat.assert_called_once()

    @patch("services.query_rewrite_service.ollama")
    def test_ollama_failure_returns_original(self, mock_ollama, sample_history):
        """On failure, return the original query unchanged."""
        mock_ollama.chat.side_effect = Exception("Model not found")

        result = rewrite_followup("How does it differ?", sample_history)

        assert result == "How does it differ?"


# ---------------------------------------------------------------------------
# TestGenerateHydePassage
# ---------------------------------------------------------------------------

class TestGenerateHydePassage:
    """Tests for generate_hyde_passage function."""

    @patch("services.query_rewrite_service.ollama")
    def test_successful_generation(self, mock_ollama):
        """Ollama generates a hypothetical passage."""
        passage_text = (
            "Concurrent access is handled through locking mechanisms. "
            "Databases use transactions with isolation levels to prevent conflicts. "
            "Optimistic and pessimistic locking are two common strategies."
        )
        mock_ollama.chat.return_value = {
            "message": {"content": passage_text}
        }

        result = generate_hyde_passage("What approaches exist for handling concurrent access?")

        assert result is not None
        assert "concurrent" in result.lower() or "locking" in result.lower()
        mock_ollama.chat.assert_called_once()

    @patch("services.query_rewrite_service.ollama")
    def test_ollama_failure_returns_none(self, mock_ollama):
        """On failure, return None."""
        mock_ollama.chat.side_effect = Exception("Timeout")

        result = generate_hyde_passage("Abstract question here")

        assert result is None


# ---------------------------------------------------------------------------
# TestConfidenceGate
# ---------------------------------------------------------------------------

class TestConfidenceGate:
    """Tests for confidence_gate function."""

    @patch("services.query_rewrite_service.generate_embeddings")
    def test_passes_threshold(self, mock_embeddings):
        """Rewritten query passes when similarity >= threshold."""
        # Two similar vectors (high cosine similarity)
        mock_embeddings.return_value = [[1.0, 0.0, 0.0]]

        def side_effect(texts):
            if "original" in texts[0]:
                return [[1.0, 0.0, 0.0]]
            return [[0.9, 0.1, 0.0]]

        mock_embeddings.side_effect = side_effect

        selected_query, similarity = confidence_gate(
            "original query", "rewritten query", threshold=0.4
        )

        assert selected_query == "rewritten query"
        assert similarity is not None
        assert similarity >= 0.4

    @patch("services.query_rewrite_service.generate_embeddings")
    def test_fails_threshold_drift_detected(self, mock_embeddings):
        """Rewritten query rejected when similarity < threshold (drift)."""
        # Two orthogonal vectors (zero cosine similarity)
        def side_effect(texts):
            if "original" in texts[0]:
                return [[1.0, 0.0, 0.0]]
            return [[0.0, 1.0, 0.0]]

        mock_embeddings.side_effect = side_effect

        selected_query, similarity = confidence_gate(
            "original query", "completely different topic", threshold=0.4
        )

        assert selected_query == "original query"
        assert similarity is not None
        assert similarity < 0.4

    @patch("services.query_rewrite_service.generate_embeddings")
    def test_embedding_failure_returns_original(self, mock_embeddings):
        """On embedding error, return original query."""
        mock_embeddings.side_effect = RuntimeError("Ollama embed failed")

        selected_query, similarity = confidence_gate(
            "original query", "rewritten query", threshold=0.4
        )

        assert selected_query == "original query"
        assert similarity is None


# ---------------------------------------------------------------------------
# TestRewriteQuery (orchestrator)
# ---------------------------------------------------------------------------

class TestRewriteQuery:
    """Tests for the main rewrite_query orchestrator."""

    @patch("services.query_rewrite_service.classify_query")
    def test_standalone_passthrough(self, mock_classify):
        """Standalone queries pass through with effective_query == original."""
        mock_classify.return_value = QueryClassification(
            query_type=QueryType.standalone,
            reasoning="Self-contained query",
        )

        result = rewrite_query("What is Python?", [])

        assert isinstance(result, RewriteResult)
        assert result.effective_query == "What is Python?"
        assert result.query_type == QueryType.standalone.value
        assert result.rewritten_query is None
        assert result.hyde_passage is None
        assert result.used_fallback is False

    @patch("services.query_rewrite_service.confidence_gate")
    @patch("services.query_rewrite_service.rewrite_followup")
    @patch("services.query_rewrite_service.classify_query")
    def test_follow_up_rewrite_and_gate(self, mock_classify, mock_rewrite, mock_gate, sample_history):
        """Follow-up: classify -> rewrite -> confidence gate."""
        mock_classify.return_value = QueryClassification(
            query_type=QueryType.follow_up,
            reasoning="Uses pronoun 'it'",
        )
        mock_rewrite.return_value = "What are the costs of the machine learning project?"
        mock_gate.return_value = ("What are the costs of the machine learning project?", 0.75)

        result = rewrite_query("What about the costs?", sample_history)

        assert result.query_type == QueryType.follow_up.value
        assert result.effective_query == "What are the costs of the machine learning project?"
        assert result.rewritten_query == "What are the costs of the machine learning project?"
        assert result.confidence_score == 0.75
        assert result.used_fallback is False
        mock_rewrite.assert_called_once()
        mock_gate.assert_called_once()

    @patch("services.query_rewrite_service.generate_embeddings")
    @patch("services.query_rewrite_service.confidence_gate")
    @patch("services.query_rewrite_service.generate_hyde_passage")
    @patch("services.query_rewrite_service.classify_query")
    def test_abstract_hyde_path(self, mock_classify, mock_hyde, mock_gate, mock_embed, sample_history):
        """Abstract: classify -> HyDE -> confidence gate, sets hyde_embedding."""
        mock_classify.return_value = QueryClassification(
            query_type=QueryType.abstract,
            reasoning="Broad conceptual question",
        )
        hyde_passage = "Concurrent access is managed via locking and transactions."
        mock_hyde.return_value = hyde_passage
        mock_gate.return_value = (hyde_passage, 0.55)
        mock_embed.return_value = [[0.1, 0.2, 0.3]]

        result = rewrite_query("What approaches exist for handling concurrent access?", sample_history)

        assert result.query_type == QueryType.abstract.value
        assert result.hyde_passage == hyde_passage
        assert result.hyde_embedding == [0.1, 0.2, 0.3]
        assert result.confidence_score == 0.55
        mock_hyde.assert_called_once()

    @patch("services.query_rewrite_service.classify_query")
    def test_unhandled_exception_returns_original(self, mock_classify):
        """On any unhandled exception, return original with used_fallback=True."""
        mock_classify.side_effect = RuntimeError("Unexpected internal error")

        result = rewrite_query("Some query", [{"role": "user", "content": "hi"}])

        assert result.effective_query == "Some query"
        assert result.original_query == "Some query"
        assert result.used_fallback is True


# ---------------------------------------------------------------------------
# TestHelpers
# ---------------------------------------------------------------------------

class TestHelpers:
    """Tests for private helper functions."""

    def test_format_history_basic(self, sample_history):
        """Formats history into readable User/Assistant text."""
        formatted = _format_history(sample_history, window=10)

        assert "User:" in formatted
        assert "Assistant:" in formatted
        assert "machine learning" in formatted.lower()

    def test_format_history_window_limit(self, long_history):
        """Only the last N messages are included."""
        formatted = _format_history(long_history, window=4)

        # 10 total messages, window=4 -> only last 4
        assert "User message 4" in formatted
        assert "Assistant response 5" in formatted
        # Early messages should be excluded
        assert "User message 1" not in formatted

    def test_cosine_similarity_identical_vectors(self):
        """Identical vectors have similarity 1.0."""
        similarity = _cosine_similarity([1.0, 2.0, 3.0], [1.0, 2.0, 3.0])
        assert abs(similarity - 1.0) < 1e-9

    def test_cosine_similarity_orthogonal_vectors(self):
        """Orthogonal vectors have similarity 0.0."""
        similarity = _cosine_similarity([1.0, 0.0], [0.0, 1.0])
        assert abs(similarity - 0.0) < 1e-9

    def test_cosine_similarity_opposite_vectors(self):
        """Opposite vectors have similarity -1.0."""
        similarity = _cosine_similarity([1.0, 0.0], [-1.0, 0.0])
        assert abs(similarity - (-1.0)) < 1e-9

    def test_cosine_similarity_zero_vector(self):
        """Zero magnitude vector returns 0.0."""
        similarity = _cosine_similarity([0.0, 0.0], [1.0, 2.0])
        assert similarity == 0.0
