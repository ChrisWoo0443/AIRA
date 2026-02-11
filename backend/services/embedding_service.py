"""
Embedding service for generating vector embeddings via Ollama.

Uses Ollama's nomic-embed-text model to generate embeddings for text chunks.
"""

import ollama


def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Generate embeddings for a list of text chunks using Ollama.

    Args:
        texts: List of text strings to embed

    Returns:
        List of embedding vectors (each vector is a list of floats)

    Raises:
        RuntimeError: If Ollama service fails or returns unexpected format
        ValueError: If embeddings don't have expected dimensions (1024)
    """
    try:
        # Call Ollama embed API with batch of texts
        response = ollama.embed(
            model='nomic-embed-text',
            input=texts
        )

        # Extract embeddings from response
        embeddings = response['embeddings']

        # Validate first embedding has correct dimensions (nomic-embed-text = 1024)
        if embeddings and len(embeddings[0]) != 1024:
            raise ValueError(
                f"Expected 1024 dimensions, got {len(embeddings[0])}"
            )

        return embeddings

    except ollama.ResponseError as e:
        raise RuntimeError(
            f"Ollama embedding failed: {str(e)}"
        ) from e
