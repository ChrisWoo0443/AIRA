"""Tests for config.py constants and SearchResult model extensions."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


def test_reranker_model_constant():
    from config import RERANKER_MODEL
    assert RERANKER_MODEL == "BAAI/bge-reranker-v2-m3"


def test_reranker_use_fp16():
    from config import RERANKER_USE_FP16
    assert RERANKER_USE_FP16 is True


def test_reranker_candidate_count():
    from config import RERANKER_CANDIDATE_COUNT
    assert RERANKER_CANDIDATE_COUNT == 30


def test_rerank_output_size():
    from config import RERANK_OUTPUT_SIZE
    assert RERANK_OUTPUT_SIZE == 5


def test_reranker_timeout_ms():
    from config import RERANKER_TIMEOUT_MS
    assert RERANKER_TIMEOUT_MS == 200


def test_rrf_k():
    from config import RRF_K
    assert RRF_K == 60


def test_rrf_dense_weight():
    from config import RRF_DENSE_WEIGHT
    assert RRF_DENSE_WEIGHT == 1.0


def test_rrf_bm25_weight():
    from config import RRF_BM25_WEIGHT
    assert RRF_BM25_WEIGHT == 1.0


def test_bm25_top_k():
    from config import BM25_TOP_K
    assert BM25_TOP_K == 30


def test_search_result_reranker_score():
    from models.search import SearchResult
    result = SearchResult(
        text="t", source_filename="f", source_doc_id="d",
        chunk_position="1/1", relevance_score=0.9,
        reranker_score=0.85,
    )
    assert result.reranker_score == 0.85


def test_search_result_reranker_score_default_none():
    from models.search import SearchResult
    result = SearchResult(
        text="t", source_filename="f", source_doc_id="d",
        chunk_position="1/1", relevance_score=0.9,
    )
    assert result.reranker_score is None


def test_search_result_bm25_rank():
    from models.search import SearchResult
    result = SearchResult(
        text="t", source_filename="f", source_doc_id="d",
        chunk_position="1/1", relevance_score=0.9,
        bm25_rank=3,
    )
    assert result.bm25_rank == 3


def test_search_result_dense_rank():
    from models.search import SearchResult
    result = SearchResult(
        text="t", source_filename="f", source_doc_id="d",
        chunk_position="1/1", relevance_score=0.9,
        dense_rank=2,
    )
    assert result.dense_rank == 2


def test_search_result_retrieval_method_default():
    from models.search import SearchResult
    result = SearchResult(
        text="t", source_filename="f", source_doc_id="d",
        chunk_position="1/1", relevance_score=0.9,
    )
    assert result.retrieval_method == "dense"


def test_search_result_retrieval_method_reranked():
    from models.search import SearchResult
    result = SearchResult(
        text="t", source_filename="f", source_doc_id="d",
        chunk_position="1/1", relevance_score=0.9,
        retrieval_method="reranked",
    )
    assert result.retrieval_method == "reranked"


def test_search_result_all_diagnostic_fields():
    from models.search import SearchResult
    result = SearchResult(
        text="t", source_filename="f", source_doc_id="d",
        chunk_position="1/1", relevance_score=0.9,
        reranker_score=0.8, bm25_rank=1, dense_rank=2,
        retrieval_method="reranked",
    )
    assert result.reranker_score == 0.8
    assert result.bm25_rank == 1
    assert result.dense_rank == 2
    assert result.retrieval_method == "reranked"


def test_search_response_unchanged():
    from models.search import SearchResponse, SearchResult
    result = SearchResult(
        text="t", source_filename="f", source_doc_id="d",
        chunk_position="1/1", relevance_score=0.9,
    )
    response = SearchResponse(query="test", results=[result], total_results=1)
    assert response.query == "test"
    assert len(response.results) == 1
    assert response.total_results == 1


def test_requirements_has_flagembedding():
    requirements_path = Path(__file__).parent.parent / "requirements.txt"
    content = requirements_path.read_text()
    assert "FlagEmbedding==1.2.11" in content


def test_requirements_has_rank_bm25():
    requirements_path = Path(__file__).parent.parent / "requirements.txt"
    content = requirements_path.read_text()
    assert "rank_bm25==0.2.2" in content


# --- Chunking config constants (Phase 03-01) ---


def test_parent_chunk_size():
    from config import PARENT_CHUNK_SIZE
    assert PARENT_CHUNK_SIZE == 1000


def test_parent_chunk_overlap():
    from config import PARENT_CHUNK_OVERLAP
    assert PARENT_CHUNK_OVERLAP == 100


def test_child_chunk_size():
    from config import CHILD_CHUNK_SIZE
    assert CHILD_CHUNK_SIZE == 300


def test_child_chunk_overlap():
    from config import CHILD_CHUNK_OVERLAP
    assert CHILD_CHUNK_OVERLAP == 50


def test_heading_separators_first_element():
    from config import HEADING_SEPARATORS
    assert HEADING_SEPARATORS[0] == "\n# "


def test_heading_separators_contains_markdown_headings():
    from config import HEADING_SEPARATORS
    assert "\n# " in HEADING_SEPARATORS
    assert "\n## " in HEADING_SEPARATORS
    assert "\n### " in HEADING_SEPARATORS


def test_heading_separators_contains_paragraph_break():
    from config import HEADING_SEPARATORS
    assert "\n\n" in HEADING_SEPARATORS


def test_heading_separators_contains_sentence_fallback():
    from config import HEADING_SEPARATORS
    assert ". " in HEADING_SEPARATORS


def test_requirements_has_tiktoken():
    requirements_path = Path(__file__).parent.parent / "requirements.txt"
    content = requirements_path.read_text()
    assert "tiktoken" in content


def test_tiktoken_importable():
    import tiktoken
    encoding = tiktoken.get_encoding("cl100k_base")
    token_count = len(encoding.encode("hello world"))
    assert token_count > 0
