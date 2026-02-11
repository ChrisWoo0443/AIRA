import uuid
import os
from pathlib import Path
from fastapi import APIRouter, UploadFile, HTTPException
import aiofiles

from models.document import DocumentResponse, UploadResponse
from services.file_validator import validate_file_extension, validate_file_type_magic, MAX_FILE_SIZE
from services.text_extractor import extract_text
from services.document_service import (
    save_document,
    list_documents,
    delete_document,
    UPLOAD_DIR
)

router = APIRouter()


@router.post("/documents/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile):
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

    return UploadResponse(
        id=doc_metadata["id"],
        filename=doc_metadata["filename"],
        size=doc_metadata["size"],
        upload_date=doc_metadata["upload_date"]
    )


@router.get("/documents")
async def get_documents():
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
async def delete_document_endpoint(doc_id: str):
    """Delete a document by ID"""
    deleted = await delete_document(doc_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "message": "Document deleted",
        "id": doc_id
    }
