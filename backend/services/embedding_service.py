"""
Embedding service for generating vector embeddings via Ollama.

Uses Ollama's bge-m3 model to generate dense embeddings for text chunks.
Model name and expected dimensions are configured in config.py.
"""

import ollama
from config import EMBEDDING_MODEL, EMBEDDING_DIMENSIONS


def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Generate embeddings for a list of text chunks using Ollama.

    Args:
        texts: List of text strings to embed

    Returns:
        List of embedding vectors (each vector is a list of floats)

    Raises:
        RuntimeError: If Ollama service fails or returns unexpected format
        ValueError: If embeddings don't have expected dimensions
    """
    try:
        # Call Ollama embed API with batch of texts
        response = ollama.embed(
            model=EMBEDDING_MODEL,
            input=texts
        )

        # Extract embeddings from response
        embeddings = response['embeddings']

        # Validate first embedding has expected dimensions
        if embeddings:
            dims = len(embeddings[0])
            if dims != EMBEDDING_DIMENSIONS:
                raise ValueError(
                    f"Unexpected embedding dimensions: {dims} (expected {EMBEDDING_DIMENSIONS})"
                )

        return embeddings

    except ollama.ResponseError as e:
        raise RuntimeError(
            f"Ollama embedding failed: {str(e)}"
        ) from e
