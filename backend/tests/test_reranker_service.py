"""Tests for reranker service with mocked FlagReranker."""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


@pytest.fixture(autouse=True)
def reset_reranker_module():
    """Reset module-level state between tests."""
    import services.reranker_service as mod
    mod._reranker = None
    mod._reranker_status = "unavailable"
    yield
    mod._reranker = None
    mod._reranker_status = "unavailable"


def test_status_unavailable_before_first_call():
    from services.reranker_service import get_reranker_status
    assert get_reranker_status() == "unavailable"


@patch("services.reranker_service.FlagReranker")
def test_rerank_returns_correct_count(mock_reranker_cls):
    mock_instance = MagicMock()
    mock_instance.compute_score.return_value = [0.9, 0.7, 0.5, 0.3, 0.1]
    mock_reranker_cls.return_value = mock_instance

    from services.reranker_service import rerank
    candidates = [
        {"text": f"doc {i}", "id": i} for i in range(5)
    ]
    results = rerank("test query", candidates, top_k=3)
    assert len(results) == 3


@patch("services.reranker_service.FlagReranker")
def test_rerank_sorts_by_score_descending(mock_reranker_cls):
    mock_instance = MagicMock()
    mock_instance.compute_score.return_value = [0.2, 0.8, 0.5]
    mock_reranker_cls.return_value = mock_instance

    from services.reranker_service import rerank
    candidates = [
        {"text": "low", "id": 0},
        {"text": "high", "id": 1},
        {"text": "mid", "id": 2},
    ]
    results = rerank("test query", candidates, top_k=3)
    assert results[0]["reranker_score"] == 0.8
    assert results[1]["reranker_score"] == 0.5
    assert results[2]["reranker_score"] == 0.2


@patch("services.reranker_service.FlagReranker")
def test_single_candidate_no_crash(mock_reranker_cls):
    """Pitfall 3: compute_score returns float for single pair."""
    mock_instance = MagicMock()
    mock_instance.compute_score.return_value = 0.75  # float, not list
    mock_reranker_cls.return_value = mock_instance

    from services.reranker_service import rerank
    candidates = [{"text": "only doc", "id": 0}]
    results = rerank("test query", candidates, top_k=1)
    assert len(results) == 1
    assert results[0]["reranker_score"] == 0.75


@patch("services.reranker_service.FlagReranker")
def test_reranker_score_added_to_each_result(mock_reranker_cls):
    mock_instance = MagicMock()
    mock_instance.compute_score.return_value = [0.9, 0.6]
    mock_reranker_cls.return_value = mock_instance

    from services.reranker_service import rerank
    candidates = [
        {"text": "doc A", "id": 0},
        {"text": "doc B", "id": 1},
    ]
    results = rerank("test query", candidates, top_k=2)
    for result in results:
        assert "reranker_score" in result
        assert isinstance(result["reranker_score"], float)


@patch("services.reranker_service.FlagReranker")
def test_status_ready_after_rerank(mock_reranker_cls):
    mock_instance = MagicMock()
    mock_instance.compute_score.return_value = [0.5]
    mock_reranker_cls.return_value = mock_instance

    from services.reranker_service import get_reranker_status, rerank
    candidates = [{"text": "doc", "id": 0}]
    rerank("test query", candidates, top_k=1)
    assert get_reranker_status() == "ready"


@patch("services.reranker_service.FlagReranker")
def test_extra_keys_preserved_in_output(mock_reranker_cls):
    mock_instance = MagicMock()
    mock_instance.compute_score.return_value = [0.9]
    mock_reranker_cls.return_value = mock_instance

    from services.reranker_service import rerank
    candidates = [{"text": "doc", "id": 42, "metadata": {"source": "test"}}]
    results = rerank("test query", candidates, top_k=1)
    assert results[0]["id"] == 42
    assert results[0]["metadata"]["source"] == "test"


@patch("services.reranker_service.FlagReranker")
def test_reranker_calls_compute_score_with_normalize(mock_reranker_cls):
    mock_instance = MagicMock()
    mock_instance.compute_score.return_value = [0.5]
    mock_reranker_cls.return_value = mock_instance

    from services.reranker_service import rerank
    candidates = [{"text": "doc"}]
    rerank("test", candidates, top_k=1)
    mock_instance.compute_score.assert_called_once()
    call_kwargs = mock_instance.compute_score.call_args
    assert call_kwargs[1]["normalize"] is True
