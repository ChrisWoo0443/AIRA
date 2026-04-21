import uuid
import os
import logging
from pathlib import Path
from fastapi import APIRouter, UploadFile, HTTPException
from starlette.requests import Request
import aiofiles

from models.document import DocumentResponse, UploadResponse
from services.file_validator import validate_file_extension, validate_file_type_magic, MAX_FILE_SIZE
from rate_limiter import limiter
from validators import validate_uuid
from services.text_extractor import extract_text
from services.document_service import (
    save_document,
    list_documents,
    delete_document,
    UPLOAD_DIR
)
from config import CONTEXTUAL_RETRIEVAL_ENABLED
from services.chunking_service import chunk_document
from services.contextual_retrieval_service import generate_chunk_contexts
from services.embedding_service import generate_embeddings
from services.vector_service import add_chunks, delete_document_vectors
from services import bm25_index_service

# Setup logging
logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/documents/upload", response_model=UploadResponse)
@limiter.limit("10/minute")
async def upload_document(request: Request, file: UploadFile):
    """Upload a document (PDF, text, or markdown)"""
    # Validate extension
    if not validate_file_extension(file.filename):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Allowed: .pdf, .txt, .md"
        )

    # Generate unique ID and filename
    doc_id = str(uuid.uuid4())
    file_ext = os.path.splitext(file.filename)[1].lower()
    unique_filename = f"{doc_id}{file_ext}"
    file_path = UPLOAD_DIR / unique_filename

    # Stream file to disk with size validation
    file_size = 0
    try:
        async with aiofiles.open(file_path, mode='wb') as f:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                file_size += len(chunk)
                if file_size > MAX_FILE_SIZE:
                    # Delete partial file
                    await f.close()
                    if file_path.exists():
                        file_path.unlink()
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Maximum size: {MAX_FILE_SIZE / (1024 * 1024)} MB"
                    )
                await f.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Error saving file: {str(e)}")

    # Validate file type with magic bytes
    if not validate_file_type_magic(str(file_path)):
        file_path.unlink()
        raise HTTPException(
            status_code=400,
            detail="Invalid file content. File does not match expected type."
        )

    # Extract text
    extraction_status = "pending"
    text_content = ""
    try:
        text_content = await extract_text(str(file_path), file_ext)
        extraction_status = "success" if text_content else "failed"
    except Exception:
        extraction_status = "failed"

    # Save document metadata
    doc_metadata = await save_document(
        doc_id=doc_id,
        filename=file.filename,
        size=file_size,
        file_path=str(file_path),
        text_content=text_content,
        extraction_status=extraction_status
    )

    # Trigger ingestion pipeline if extraction succeeded
    indexing_status = "pending"
    if extraction_status == "success" and text_content:
        try:
            # Two-pass chunking: children for embedding, parents for LLM context
            chunk_result = chunk_document(text_content)
            child_chunks = chunk_result["child_chunks"]
            parent_texts = chunk_result["parent_texts"]
            child_to_parent_index = chunk_result["child_to_parent_index"]

            # Contextual retrieval: generate context prefixes (CXRET-01, D-07)
            context_prefixes = [""] * len(child_chunks)
            if CONTEXTUAL_RETRIEVAL_ENABLED:
                logger.info("Generating context summaries for %d chunks...", len(child_chunks))
                context_prefixes = generate_chunk_contexts(text_content, child_chunks)

            # Prepend context to chunks for embedding and BM25 (CXRET-02)
            chunks_for_embedding = []
            for i, chunk in enumerate(child_chunks):
                if context_prefixes[i]:
                    chunks_for_embedding.append(f"{context_prefixes[i]}\n\n{chunk}")
                else:
                    chunks_for_embedding.append(chunk)

            # Embed context-enriched chunks and store with parent metadata
            embeddings = generate_embeddings(chunks_for_embedding)
            add_chunks(
                doc_id, file.filename, chunks_for_embedding, embeddings,
                parent_texts=parent_texts,
                child_to_parent_index=child_to_parent_index,
                context_prefixes=context_prefixes,
            )
            # Build BM25 index on context-enriched chunks for keyword matching
            chunk_ids = [f"{doc_id}_chunk_{i}" for i in range(len(child_chunks))]
            bm25_index_service.add_document(doc_id, chunks_for_embedding, chunk_ids)
            indexing_status = "indexed"
        except Exception as e:
            # Log error but don't fail upload - graceful degradation
            logger.warning(f"Indexing failed for doc {doc_id}: {str(e)}")
            indexing_status = "pending"

    return UploadResponse(
        id=doc_metadata["id"],
        filename=doc_metadata["filename"],
        size=doc_metadata["size"],
        upload_date=doc_metadata["upload_date"],
        indexing_status=indexing_status
    )


@router.get("/documents")
@limiter.limit("120/minute")
async def get_documents(request: Request):
    """List all uploaded documents"""
    docs = await list_documents()

    # Return only public-facing metadata
    return {
        "documents": [
            DocumentResponse(
                id=doc["id"],
                filename=doc["filename"],
                size=doc["size"],
                upload_date=doc["upload_date"]
            )
            for doc in docs
        ]
    }


@router.delete("/documents/{doc_id}")
@limiter.limit("120/minute")
async def delete_document_endpoint(request: Request, doc_id: str):
    """Delete a document by ID"""
    # Validate doc_id format
    try:
        validate_uuid(doc_id)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid document ID format: {doc_id}")

    # Clean up vectors first
    try:
        delete_document_vectors(doc_id)
    except Exception as e:
        # Log warning but proceed with document deletion
        logger.warning(f"Vector cleanup failed for doc {doc_id}: {str(e)}")

    # Clean up BM25 index (HYBRD-03)
    try:
        bm25_index_service.remove_document(doc_id)
    except Exception as e:
        logger.warning(f"BM25 cleanup failed for doc {doc_id}: {str(e)}")

    deleted = await delete_document(doc_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "message": "Document deleted",
        "id": doc_id
    }
