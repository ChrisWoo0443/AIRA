"""
Semantic chunking service with two-pass parent-child mapping.

Splits documents into large parent chunks (~1000 tokens) and smaller
child chunks (~300 tokens). Each child maps back to its parent text,
enabling parent-document retrieval: embed small children for precision,
return larger parents to the LLM for context.

Uses tiktoken cl100k_base for token-accurate sizing and heading-aware
separators that prioritize markdown headings and paragraph boundaries.
"""

import tiktoken
from langchain_text_splitters import RecursiveCharacterTextSplitter

from config import (
    PARENT_CHUNK_SIZE,
    PARENT_CHUNK_OVERLAP,
    CHILD_CHUNK_SIZE,
    CHILD_CHUNK_OVERLAP,
    HEADING_SEPARATORS,
)

_encoding = tiktoken.get_encoding("cl100k_base")


def _tiktoken_len(text: str) -> int:
    """Count tokens using cl100k_base encoding as proxy for chunk sizing."""
    return len(_encoding.encode(text))


def chunk_document(text_content: str) -> dict:
    """
    Split document into parent and child chunks using two-pass semantic chunking.

    First pass: split document into large parent chunks (~1000 tokens)
    using heading-aware separators with tiktoken-based sizing.

    Second pass: split each parent into smaller child chunks (~300 tokens).
    Each child stores its parent's text for parent-document retrieval.

    Args:
        text_content: Raw text content to chunk

    Returns:
        dict with parallel arrays:
            - child_chunks: list[str] -- small chunks for embedding
            - parent_texts: list[str] -- larger parent text per child
            - child_to_parent_index: list[int] -- maps child index to parent index
    """
    if not text_content or not text_content.strip():
        return {
            "child_chunks": [],
            "parent_texts": [],
            "child_to_parent_index": [],
        }

    parent_splitter = RecursiveCharacterTextSplitter(
        chunk_size=PARENT_CHUNK_SIZE,
        chunk_overlap=PARENT_CHUNK_OVERLAP,
        separators=HEADING_SEPARATORS,
        length_function=_tiktoken_len,
        is_separator_regex=False,
    )

    child_splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHILD_CHUNK_SIZE,
        chunk_overlap=CHILD_CHUNK_OVERLAP,
        separators=HEADING_SEPARATORS,
        length_function=_tiktoken_len,
        is_separator_regex=False,
    )

    parent_chunks = parent_splitter.split_text(text_content)

    child_chunks = []
    parent_texts = []
    child_to_parent_index = []

    for parent_idx, parent_text in enumerate(parent_chunks):
        children = child_splitter.split_text(parent_text)

        if not children:
            # Parent is too small to split further; use as its own child
            children = [parent_text]

        for child_text in children:
            child_chunks.append(child_text)
            parent_texts.append(parent_text)
            child_to_parent_index.append(parent_idx)

    return {
        "child_chunks": child_chunks,
        "parent_texts": parent_texts,
        "child_to_parent_index": child_to_parent_index,
    }
