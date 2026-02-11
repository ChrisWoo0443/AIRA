"""
Chunking service for splitting document text into manageable chunks.

Uses RecursiveCharacterTextSplitter to chunk documents with overlap
for better context preservation during embedding and retrieval.
"""

from langchain_text_splitters import RecursiveCharacterTextSplitter


def chunk_document(text_content: str) -> list[str]:
    """
    Split document text into chunks with overlap.

    Args:
        text_content: Raw text content to chunk

    Returns:
        List of text chunks (empty list if input is empty/whitespace)
    """
    # Return empty list for empty/whitespace input
    if not text_content or not text_content.strip():
        return []

    # Configure splitter with 512 char chunks and 10% overlap
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=512,
        chunk_overlap=51,  # 10% overlap
        separators=["\n\n", "\n", " ", ""],
        length_function=len,
        is_separator_regex=False
    )

    # Split and return chunks
    chunks = splitter.split_text(text_content)
    return chunks
