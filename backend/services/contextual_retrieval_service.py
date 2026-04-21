"""
Contextual retrieval service for generating LLM context summaries at ingest time.

When enabled via config, generates a 1-2 sentence context for each chunk
describing where it sits in the source document. Includes anti-hallucination
validation to reject contexts with invented terms.
"""

import logging
import re
import time
from typing import Optional

import ollama

from config import (
    CONTEXT_GENERATION_MODEL,
    CONTEXT_GENERATION_TIMEOUT,
    CONTEXT_VALIDATION_THRESHOLD,
)
from ollama_client import get_selected_model

logger = logging.getLogger(__name__)

CONTEXT_PROMPT_TEMPLATE = """<document>
{document_text}
</document>
Here is the chunk we want to situate within the whole document:
<chunk>
{chunk_text}
</chunk>
Please give a short succinct context to situate this chunk within the overall document for the purposes of improving search retrieval of the chunk. Answer only with the succinct context and nothing else."""


def _get_context_model() -> str:
    """Get model for context generation (D-05)."""
    if CONTEXT_GENERATION_MODEL:
        return CONTEXT_GENERATION_MODEL
    return get_selected_model()


def validate_context(
    context: str, chunk_text: str, document_text: str
) -> bool:
    """
    Check that substantive terms in context appear in source material.
    Anti-hallucination gate (D-06): extracts words 4+ chars, verifies
    70%+ exist in chunk or document text.

    Returns True if context passes validation, False if likely hallucinated.
    """
    context_terms = set(
        word.lower() for word in re.findall(r'\b\w{4,}\b', context)
    )
    if not context_terms:
        return True

    source_text = (chunk_text + " " + document_text).lower()
    found = sum(1 for term in context_terms if term in source_text)
    overlap_ratio = found / len(context_terms)

    return overlap_ratio >= CONTEXT_VALIDATION_THRESHOLD


def generate_chunk_context(
    document_text: str, chunk_text: str, model: str
) -> str:
    """
    Generate a 1-2 sentence context for a single chunk.

    Returns empty string on failure (graceful degradation).
    """
    # Truncate document if too large for context window
    # Most local models have 4096-8192 context; keep doc under ~6000 tokens
    max_doc_chars = 24000  # ~6000 tokens at ~4 chars/token
    truncated_doc = document_text[:max_doc_chars]

    prompt = CONTEXT_PROMPT_TEMPLATE.format(
        document_text=truncated_doc,
        chunk_text=chunk_text,
    )

    try:
        response = ollama.chat(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            options={"num_ctx": 8192},
        )
        context = response["message"]["content"].strip()

        # Validate against hallucination
        if validate_context(context, chunk_text, document_text):
            return context
        else:
            logger.warning(
                "Context failed hallucination check, discarding (overlap < %.0f%%)",
                CONTEXT_VALIDATION_THRESHOLD * 100,
            )
            return ""
    except Exception as exc:
        logger.warning("Context generation failed: %s", str(exc))
        return ""


def generate_chunk_contexts(
    document_text: str,
    child_chunks: list,
) -> list:
    """
    Generate context summaries for all chunks in a document.

    Processes sequentially per D-08 (Ollama handles one request at a time
    on CPU). Respects per-document timeout.

    Args:
        document_text: Full document text
        child_chunks: List of child chunk texts

    Returns:
        List of context strings (parallel to child_chunks).
        Empty string for chunks where generation failed or was rejected.
    """
    model = _get_context_model()
    contexts = []
    start_time = time.time()

    for i, chunk_text in enumerate(child_chunks):
        # Check timeout
        elapsed = time.time() - start_time
        if elapsed > CONTEXT_GENERATION_TIMEOUT:
            logger.warning(
                "Context generation timeout after %d/%d chunks (%.0fs)",
                i, len(child_chunks), elapsed,
            )
            # Fill remaining with empty strings
            contexts.extend([""] * (len(child_chunks) - i))
            break

        context = generate_chunk_context(document_text, chunk_text, model)
        contexts.append(context)

        if context:
            logger.info(
                "Generated context for chunk %d/%d (%d chars)",
                i + 1, len(child_chunks), len(context),
            )

    return contexts
