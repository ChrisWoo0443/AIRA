"""
Tests for contextual retrieval service.

Validates anti-hallucination logic, graceful degradation on LLM failure,
timeout enforcement, and model selection fallback.
"""

import sys
import time
from unittest.mock import patch, MagicMock


# --- validate_context tests ---

def test_validate_context_returns_true_when_all_terms_in_source():
    """Terms from context that all appear in the document should pass."""
    from services.contextual_retrieval_service import validate_context

    context = "This section covers the retrieval pipeline architecture"
    chunk_text = "retrieval pipeline architecture details section"
    document_text = "The full document about retrieval pipeline architecture and covers design"

    assert validate_context(context, chunk_text, document_text) is True


def test_validate_context_returns_false_when_terms_hallucinated():
    """Context with mostly invented terms should fail validation."""
    from services.contextual_retrieval_service import validate_context

    context = "This chunk discusses kubernetes deployment strategies and terraform modules"
    chunk_text = "The function returns a list of documents"
    document_text = "A simple application that manages documents and files"

    assert validate_context(context, chunk_text, document_text) is False


def test_validate_context_returns_true_for_empty_context():
    """Empty context has no terms to validate, so it passes."""
    from services.contextual_retrieval_service import validate_context

    assert validate_context("", "some chunk", "some document") is True


def test_validate_context_ignores_short_words():
    """Words shorter than 4 chars should be ignored in overlap check."""
    from services.contextual_retrieval_service import validate_context

    # Context with only short words (< 4 chars) should pass (no terms to check)
    context = "the and for is it on"
    chunk_text = "any text here"
    document_text = "any document text"

    assert validate_context(context, chunk_text, document_text) is True


def test_validate_context_threshold_boundary():
    """Exactly at the 70% boundary should pass."""
    from services.contextual_retrieval_service import validate_context

    # 10 substantive terms, 7 found = 70% = should pass
    context = "alpha beta gamma delta epsilon zeta theta iota kappa lambda"
    chunk_text = "alpha beta gamma delta epsilon zeta theta"
    document_text = "alpha beta gamma delta epsilon zeta theta unrelated"

    assert validate_context(context, chunk_text, document_text) is True


# --- generate_chunk_context tests ---

@patch("services.contextual_retrieval_service.ollama")
def test_generate_chunk_context_returns_empty_on_ollama_error(mock_ollama):
    """If ollama.chat raises, return empty string (graceful degradation)."""
    from services.contextual_retrieval_service import generate_chunk_context

    mock_ollama.chat.side_effect = ConnectionError("Ollama not running")

    result = generate_chunk_context("full document text", "chunk text", "llama3:8b")
    assert result == ""


@patch("services.contextual_retrieval_service.ollama")
def test_generate_chunk_context_returns_empty_when_validation_fails(mock_ollama):
    """If generated context fails hallucination check, return empty string."""
    from services.contextual_retrieval_service import generate_chunk_context

    # Return a hallucinated context (terms not in source)
    mock_ollama.chat.return_value = {
        "message": {"content": "This discusses kubernetes terraform infrastructure deployment"}
    }

    result = generate_chunk_context(
        "A simple Python function that processes files",
        "def process_file(path): return open(path).read()",
        "llama3:8b",
    )
    assert result == ""


@patch("services.contextual_retrieval_service.ollama")
def test_generate_chunk_context_returns_valid_context(mock_ollama):
    """If generated context passes validation, return it."""
    from services.contextual_retrieval_service import generate_chunk_context

    document_text = "The retrieval pipeline processes documents through chunking and embedding"
    chunk_text = "chunking splits documents into smaller pieces"
    generated_context = "This chunk describes how chunking splits documents into pieces for retrieval"

    mock_ollama.chat.return_value = {
        "message": {"content": generated_context}
    }

    result = generate_chunk_context(document_text, chunk_text, "llama3:8b")
    assert result == generated_context


# --- generate_chunk_contexts tests ---

@patch("services.contextual_retrieval_service.ollama")
@patch("services.contextual_retrieval_service.CONTEXT_GENERATION_TIMEOUT", 0.1)
def test_generate_chunk_contexts_respects_timeout(mock_ollama):
    """Timeout should stop processing and fill remaining with empty strings."""
    from services.contextual_retrieval_service import generate_chunk_contexts

    call_count = 0

    def slow_chat(**kwargs):
        nonlocal call_count
        call_count += 1
        time.sleep(0.15)  # Each call takes longer than timeout
        return {"message": {"content": "valid context about documents"}}

    mock_ollama.chat.side_effect = slow_chat

    document_text = "A document about processing files and documents"
    chunks = ["chunk one about documents", "chunk two about files", "chunk three about processing"]

    result = generate_chunk_contexts(document_text, chunks)

    assert len(result) == 3
    # At least some chunks should have empty context due to timeout
    assert "" in result


# --- _get_context_model tests ---

@patch("services.contextual_retrieval_service.CONTEXT_GENERATION_MODEL", None)
@patch("services.contextual_retrieval_service.get_selected_model")
def test_get_context_model_falls_back_to_selected_model(mock_get_model):
    """When CONTEXT_GENERATION_MODEL is None, use get_selected_model()."""
    from services.contextual_retrieval_service import _get_context_model

    mock_get_model.return_value = "mistral:7b"
    assert _get_context_model() == "mistral:7b"
    mock_get_model.assert_called_once()


@patch("services.contextual_retrieval_service.CONTEXT_GENERATION_MODEL", "qwen2:7b")
def test_get_context_model_uses_configured_model():
    """When CONTEXT_GENERATION_MODEL is set, use it directly."""
    from services.contextual_retrieval_service import _get_context_model

    assert _get_context_model() == "qwen2:7b"


# --- Config defaults ---

def test_config_contextual_retrieval_disabled_by_default():
    """CONTEXTUAL_RETRIEVAL_ENABLED should default to False."""
    from config import CONTEXTUAL_RETRIEVAL_ENABLED

    assert CONTEXTUAL_RETRIEVAL_ENABLED is False


def test_config_context_generation_model_defaults_to_none():
    """CONTEXT_GENERATION_MODEL should default to None (use chat model)."""
    from config import CONTEXT_GENERATION_MODEL

    assert CONTEXT_GENERATION_MODEL is None
