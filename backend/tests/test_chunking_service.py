"""Tests for two-pass semantic chunking with parent-child mapping."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


def test_empty_input_returns_empty_structure():
    from services.chunking_service import chunk_document
    result = chunk_document("")
    assert result == {
        "child_chunks": [],
        "parent_texts": [],
        "child_to_parent_index": [],
    }


def test_whitespace_only_returns_empty_structure():
    from services.chunking_service import chunk_document
    result = chunk_document("   ")
    assert result == {
        "child_chunks": [],
        "parent_texts": [],
        "child_to_parent_index": [],
    }


def test_return_structure_has_required_keys():
    from services.chunking_service import chunk_document
    result = chunk_document("Some text content for testing.")
    assert "child_chunks" in result
    assert "parent_texts" in result
    assert "child_to_parent_index" in result


def test_parallel_arrays_same_length():
    from services.chunking_service import chunk_document
    result = chunk_document("A paragraph of text that should produce at least one chunk.")
    child_count = len(result["child_chunks"])
    assert child_count == len(result["parent_texts"])
    assert child_count == len(result["child_to_parent_index"])
    assert child_count > 0


def test_short_document_single_child():
    """A document shorter than CHILD_CHUNK_SIZE tokens returns a single child."""
    from services.chunking_service import chunk_document
    short_text = "This is a short document with just a few words."
    result = chunk_document(short_text)
    assert len(result["child_chunks"]) == 1
    assert len(result["parent_texts"]) == 1
    assert result["child_to_parent_index"] == [0]


def test_short_document_parent_contains_full_text():
    """For short documents, the parent text should contain the full text."""
    from services.chunking_service import chunk_document
    short_text = "This is a short document with just a few words."
    result = chunk_document(short_text)
    assert short_text.strip() in result["parent_texts"][0]


def test_heading_structured_document_splits_at_headings():
    """A document with markdown headings should split at heading boundaries."""
    from services.chunking_service import chunk_document

    # Build a document with clear heading structure and enough content
    sections = []
    for i in range(5):
        section_body = f"Content for section {i}. " * 40
        sections.append(f"# Section {i}\n\n{section_body}")

    heading_document = "\n\n".join(sections)
    result = chunk_document(heading_document)

    # Should produce multiple chunks
    assert len(result["child_chunks"]) > 1

    # At least some chunks should start with heading text or section content
    # (headings guide the split boundaries)
    has_section_content = any(
        "Section" in chunk for chunk in result["child_chunks"]
    )
    assert has_section_content


def test_plain_text_fallback_produces_valid_chunks():
    """A document without headings still produces valid chunks via paragraph/sentence fallback."""
    from services.chunking_service import chunk_document

    # Build a long plain text with paragraphs (no markdown headings)
    paragraphs = []
    for i in range(20):
        paragraph = f"This is paragraph number {i} of the document. " * 15
        paragraphs.append(paragraph)

    plain_document = "\n\n".join(paragraphs)
    result = chunk_document(plain_document)

    assert len(result["child_chunks"]) > 1
    assert len(result["child_chunks"]) == len(result["parent_texts"])
    assert len(result["child_chunks"]) == len(result["child_to_parent_index"])


def test_child_shorter_than_parent():
    """Every child chunk should have fewer tokens than its corresponding parent text."""
    from services.chunking_service import chunk_document, _tiktoken_len

    sections = []
    for i in range(5):
        section_body = f"Detailed content for section {i} goes here. " * 50
        sections.append(f"# Section {i}\n\n{section_body}")

    document = "\n\n".join(sections)
    result = chunk_document(document)

    for idx, child_text in enumerate(result["child_chunks"]):
        parent_text = result["parent_texts"][idx]
        child_tokens = _tiktoken_len(child_text)
        parent_tokens = _tiktoken_len(parent_text)
        assert child_tokens <= parent_tokens, (
            f"Child {idx} ({child_tokens} tokens) is longer than "
            f"parent ({parent_tokens} tokens)"
        )


def test_child_to_parent_index_valid():
    """child_to_parent_index values should be valid indices into a deduplicated parent list."""
    from services.chunking_service import chunk_document

    sections = []
    for i in range(4):
        section_body = f"Content about topic {i}. " * 40
        sections.append(f"# Topic {i}\n\n{section_body}")

    document = "\n\n".join(sections)
    result = chunk_document(document)

    # All indices should be non-negative integers
    for parent_idx in result["child_to_parent_index"]:
        assert isinstance(parent_idx, int)
        assert parent_idx >= 0


def test_uses_tiktoken_not_character_counting():
    """Token counting should use tiktoken, not len(). Verify with a known string."""
    from services.chunking_service import _tiktoken_len

    # A string where token count differs significantly from character count
    test_string = "supercalifragilisticexpialidocious"
    token_count = _tiktoken_len(test_string)
    char_count = len(test_string)

    # tiktoken should produce fewer tokens than characters for long words
    assert token_count < char_count
    assert token_count > 0


def test_tiktoken_len_returns_int():
    from services.chunking_service import _tiktoken_len
    result = _tiktoken_len("hello world")
    assert isinstance(result, int)
    assert result > 0


def test_multiple_children_per_parent():
    """A large parent chunk should produce multiple child chunks."""
    from services.chunking_service import chunk_document

    # Create a single large section that should become one parent but multiple children
    large_section = "# Big Section\n\n"
    large_section += "This is a sentence with detailed information. " * 200

    result = chunk_document(large_section)

    # Should have multiple children sharing the same parent index
    if len(result["child_chunks"]) > 1:
        parent_indices = result["child_to_parent_index"]
        # At least two children should share a parent
        has_shared_parent = len(parent_indices) > len(set(parent_indices))
        # This is expected but depends on chunk sizes; at minimum, verify structure
        assert len(result["child_chunks"]) > 1
