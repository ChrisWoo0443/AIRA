"""
Query rewrite service for conversational follow-ups and HyDE generation.

Classifies each user query (standalone / follow_up / abstract), rewrites
follow-up queries using session history, generates hypothetical passages
for abstract queries, and applies an embedding-based confidence gate to
detect topic drift.

Config-gated via QUERY_REWRITING_ENABLED. All LLM failures gracefully
fall back to the original query.
"""

import logging
import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import ollama
from pydantic import BaseModel

from config import (
    QUERY_REWRITE_MODEL,
    QUERY_REWRITE_HISTORY_WINDOW,
    CONFIDENCE_GATE_THRESHOLD,
    HYDE_CONFIDENCE_GATE_THRESHOLD,
    HYDE_PASSAGE_MAX_TOKENS,
)
from ollama_client import get_selected_model
from services.embedding_service import generate_embeddings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

class QueryType(str, Enum):
    """Classification types for user queries."""
    standalone = "standalone"
    follow_up = "follow_up"
    abstract = "abstract"


class QueryClassification(BaseModel):
    """Structured output from the LLM query classifier."""
    query_type: QueryType
    reasoning: str


@dataclass
class RewriteResult:
    """Result of the query rewriting pipeline."""
    original_query: str
    effective_query: str
    query_type: str
    rewritten_query: Optional[str] = None
    hyde_passage: Optional[str] = None
    hyde_embedding: Optional[list] = field(default=None)
    confidence_score: Optional[float] = None
    used_fallback: bool = False


# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------

CLASSIFICATION_PROMPT = """Classify the user's latest query given the conversation history.

CONVERSATION HISTORY:
{history}

LATEST QUERY: {query}

Classify as one of:
- "standalone": The query makes complete sense on its own. It does not reference anything from the conversation. Even if there is conversation history, the query is self-contained. Examples: "What is machine learning?", "Now tell me about climate change."
- "follow_up": The query references or depends on the conversation. It uses pronouns like "it", "they", "that", references like "the second one", "the same document", or is otherwise ambiguous without context. Examples: "What about the costs?", "Tell me more", "Can you explain that part?"
- "abstract": The query is a broad, conceptual, or hypothetical question that would benefit from generating a hypothetical answer passage before searching. The query does not contain specific names, numbers, or identifiers. Examples: "What approaches exist for handling concurrent access?", "How should a company think about data governance?"

IMPORTANT: If the query is a topic change or pivot (introduces a new subject not discussed before), classify as "standalone" even if conversation history exists.

Return your classification and a brief reasoning."""

REWRITE_PROMPT = """Given the conversation history below, rewrite the user's latest query as a standalone search query.

RULES:
- Resolve all pronouns and references using conversation context
- Keep the rewrite concise -- one sentence, search-query style
- Do NOT answer the question -- only reformulate it
- Do NOT add information the user did not express or imply
- Preserve the user's original intent exactly

CONVERSATION HISTORY:
{history}

LATEST QUERY: {query}

STANDALONE SEARCH QUERY:"""

HYDE_PROMPT = """Write a short passage (3-5 sentences) that would appear in a document answering this question. Write as if you are the document author, not as if you are answering the user. Be factual in tone. Do not hedge or qualify.

QUESTION: {query}

PASSAGE:"""


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _get_rewrite_model() -> str:
    """Get the model to use for query rewriting. Falls back to selected chat model."""
    if QUERY_REWRITE_MODEL:
        return QUERY_REWRITE_MODEL
    return get_selected_model()


def _format_history(conversation_history: list[dict], window: int) -> str:
    """
    Format conversation history into readable text for prompts.

    Takes the last `window` messages and formats as:
        User: ...
        Assistant: ...

    Args:
        conversation_history: List of {role, content} dicts.
        window: Maximum number of messages to include.

    Returns:
        Formatted history string.
    """
    recent_messages = conversation_history[-window:]
    lines = []
    for message in recent_messages:
        role_label = "User" if message["role"] == "user" else "Assistant"
        lines.append(f"{role_label}: {message['content']}")
    return "\n".join(lines)


def _cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """
    Compute cosine similarity between two vectors.

    Returns 0.0 if either vector has zero magnitude.
    """
    dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
    magnitude_a = math.sqrt(sum(a * a for a in vec_a))
    magnitude_b = math.sqrt(sum(b * b for b in vec_b))
    if magnitude_a == 0 or magnitude_b == 0:
        return 0.0
    return dot_product / (magnitude_a * magnitude_b)


# ---------------------------------------------------------------------------
# Core functions
# ---------------------------------------------------------------------------

def classify_query(
    query: str, conversation_history: list[dict]
) -> QueryClassification:
    """
    Classify a user query as standalone, follow_up, or abstract.

    Short-circuits to standalone when conversation_history is empty.
    Uses Ollama structured output with Pydantic schema.
    Falls back to standalone on any error.

    Args:
        query: The user's current query.
        conversation_history: List of {role, content} message dicts.

    Returns:
        QueryClassification with query_type and reasoning.
    """
    if not conversation_history:
        return QueryClassification(
            query_type=QueryType.standalone,
            reasoning="No conversation history",
        )

    model = _get_rewrite_model()
    history_text = _format_history(
        conversation_history, QUERY_REWRITE_HISTORY_WINDOW
    )

    try:
        response = ollama.chat(
            model=model,
            messages=[{
                "role": "user",
                "content": CLASSIFICATION_PROMPT.format(
                    history=history_text, query=query,
                ),
            }],
            format=QueryClassification.model_json_schema(),
            options={"temperature": 0, "num_predict": 100},
        )

        return QueryClassification.model_validate_json(
            response["message"]["content"]
        )
    except Exception as exc:
        logger.warning("Query classification failed: %s, defaulting to standalone", str(exc))
        return QueryClassification(
            query_type=QueryType.standalone,
            reasoning=f"Classification failed: {str(exc)}",
        )


def rewrite_followup(
    query: str, conversation_history: list[dict]
) -> str:
    """
    Rewrite a follow-up query into a standalone search query.

    Resolves pronouns and references using conversation history.
    Falls back to the original query on any error.

    Args:
        query: The user's follow-up query.
        conversation_history: List of {role, content} message dicts.

    Returns:
        Rewritten standalone query string.
    """
    model = _get_rewrite_model()
    history_text = _format_history(
        conversation_history, QUERY_REWRITE_HISTORY_WINDOW
    )

    try:
        response = ollama.chat(
            model=model,
            messages=[{
                "role": "user",
                "content": REWRITE_PROMPT.format(
                    history=history_text, query=query,
                ),
            }],
            options={"temperature": 0},
        )

        rewritten = response["message"]["content"].strip()
        return rewritten if rewritten else query
    except Exception as exc:
        logger.warning("Query rewriting failed: %s, using original", str(exc))
        return query


def generate_hyde_passage(query: str) -> Optional[str]:
    """
    Generate a hypothetical document passage for HyDE-based retrieval.

    Produces a 3-5 sentence passage that would appear in a document
    answering the query. Returns None on failure.

    Args:
        query: The user's abstract query.

    Returns:
        Hypothetical passage text, or None on failure.
    """
    model = _get_rewrite_model()

    try:
        response = ollama.chat(
            model=model,
            messages=[{
                "role": "user",
                "content": HYDE_PROMPT.format(query=query),
            }],
            options={"temperature": 0.7, "num_predict": HYDE_PASSAGE_MAX_TOKENS},
        )

        passage = response["message"]["content"].strip()
        return passage if passage else None
    except Exception as exc:
        logger.warning("HyDE passage generation failed: %s", str(exc))
        return None


def confidence_gate(
    original_query: str,
    rewritten_query: str,
    threshold: float,
) -> tuple[str, Optional[float]]:
    """
    Check if a rewritten query drifted from the original intent.

    Compares embeddings of original and rewritten queries via cosine
    similarity. Falls back to original if similarity is below threshold.

    Args:
        original_query: The user's original query.
        rewritten_query: The rewritten or HyDE-generated query.
        threshold: Minimum cosine similarity to accept the rewrite.

    Returns:
        Tuple of (selected_query, similarity_score).
        similarity_score is None if embedding failed.
    """
    try:
        original_embedding = generate_embeddings([original_query])[0]
        rewritten_embedding = generate_embeddings([rewritten_query])[0]

        similarity = _cosine_similarity(original_embedding, rewritten_embedding)

        if similarity < threshold:
            logger.warning(
                "Rewrite drifted (similarity=%.3f < %.3f), using original query",
                similarity, threshold,
            )
            return original_query, similarity

        return rewritten_query, similarity
    except Exception as exc:
        logger.warning("Confidence gate embedding failed: %s, using original", str(exc))
        return original_query, None


def rewrite_query(
    query: str, conversation_history: list[dict]
) -> RewriteResult:
    """
    Main query rewriting orchestrator.

    Pipeline: classify -> rewrite/HyDE -> confidence gate.

    1. Classify the query (standalone / follow_up / abstract)
    2. If standalone: pass through unchanged
    3. If follow_up: rewrite using history, apply confidence gate
    4. If abstract: generate HyDE passage, embed it, apply confidence gate

    All failures fall back to the original query.

    Args:
        query: The user's current query.
        conversation_history: List of {role, content} message dicts.

    Returns:
        RewriteResult with effective_query and metadata.
    """
    try:
        classification = classify_query(query, conversation_history)
        query_type = classification.query_type

        # Standalone: pass through
        if query_type == QueryType.standalone:
            return RewriteResult(
                original_query=query,
                effective_query=query,
                query_type=query_type.value,
            )

        # Follow-up: rewrite + confidence gate
        if query_type == QueryType.follow_up:
            rewritten = rewrite_followup(query, conversation_history)
            gated_query, similarity = confidence_gate(
                query, rewritten, CONFIDENCE_GATE_THRESHOLD,
            )
            used_fallback = gated_query == query and rewritten != query
            return RewriteResult(
                original_query=query,
                effective_query=gated_query,
                query_type=query_type.value,
                rewritten_query=rewritten,
                confidence_score=similarity,
                used_fallback=used_fallback,
            )

        # Abstract: HyDE + confidence gate
        if query_type == QueryType.abstract:
            hyde_passage = generate_hyde_passage(query)
            hyde_embedding = None
            confidence_score = None
            effective_query = query

            if hyde_passage:
                gated_query, similarity = confidence_gate(
                    query, hyde_passage, HYDE_CONFIDENCE_GATE_THRESHOLD,
                )
                confidence_score = similarity
                effective_query = gated_query

                # Embed the HyDE passage for use in search
                if gated_query == hyde_passage:
                    try:
                        embeddings = generate_embeddings([hyde_passage])
                        hyde_embedding = embeddings[0]
                    except Exception as embed_exc:
                        logger.warning(
                            "HyDE embedding failed: %s, using original query",
                            str(embed_exc),
                        )
                        effective_query = query

            used_fallback = effective_query == query and hyde_passage is not None
            return RewriteResult(
                original_query=query,
                effective_query=effective_query,
                query_type=query_type.value,
                hyde_passage=hyde_passage,
                hyde_embedding=hyde_embedding,
                confidence_score=confidence_score,
                used_fallback=used_fallback,
            )

        # Unknown type fallback (should not happen)
        return RewriteResult(
            original_query=query,
            effective_query=query,
            query_type=query_type.value,
            used_fallback=True,
        )

    except Exception as exc:
        logger.warning("Query rewriting failed: %s, using original query", str(exc))
        return RewriteResult(
            original_query=query,
            effective_query=query,
            query_type=QueryType.standalone.value,
            used_fallback=True,
        )
