from pydantic import BaseModel
from typing import Literal


class DocumentMetadata(BaseModel):
    """Complete document metadata stored in JSON file"""
    id: str
    filename: str
    size: int
    upload_date: str  # ISO format
    file_path: str
    text_path: str
    extraction_status: Literal["success", "failed", "pending"]


class DocumentResponse(BaseModel):
    """Document metadata returned to frontend (no internal paths)"""
    id: str
    filename: str
    size: int
    upload_date: str


class UploadResponse(BaseModel):
    """Response returned after successful upload"""
    id: str
    filename: str
    size: int
    upload_date: str
