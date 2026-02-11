import json
import aiofiles
from pathlib import Path
from typing import Optional
from datetime import datetime


# Storage directories
UPLOAD_DIR = Path("uploads/files")
TEXT_DIR = Path("uploads/text")
METADATA_FILE = Path("uploads/metadata.json")

# Create directories on import
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
TEXT_DIR.mkdir(parents=True, exist_ok=True)


async def load_metadata() -> dict:
    """Load metadata from JSON file"""
    if not METADATA_FILE.exists():
        return {}

    try:
        async with aiofiles.open(METADATA_FILE, mode='r') as f:
            content = await f.read()
            return json.loads(content)
    except Exception:
        return {}


async def save_metadata(metadata: dict):
    """Save metadata to JSON file"""
    async with aiofiles.open(METADATA_FILE, mode='w') as f:
        await f.write(json.dumps(metadata, indent=2))


async def save_document(
    doc_id: str,
    filename: str,
    size: int,
    file_path: str,
    text_content: str,
    extraction_status: str
) -> dict:
    """Save document metadata and extracted text"""
    # Save extracted text
    text_file_path = TEXT_DIR / f"{doc_id}.txt"
    async with aiofiles.open(text_file_path, mode='w', encoding='utf-8') as f:
        await f.write(text_content)

    # Load existing metadata
    metadata = await load_metadata()

    # Add new document entry
    upload_date = datetime.utcnow().isoformat() + "Z"
    metadata[doc_id] = {
        "id": doc_id,
        "filename": filename,
        "size": size,
        "upload_date": upload_date,
        "file_path": file_path,
        "text_path": str(text_file_path),
        "extraction_status": extraction_status
    }

    # Save metadata
    await save_metadata(metadata)

    return metadata[doc_id]


async def list_documents() -> list:
    """List all documents sorted by upload date (newest first)"""
    metadata = await load_metadata()
    docs = list(metadata.values())
    docs.sort(key=lambda x: x["upload_date"], reverse=True)
    return docs


async def get_document(doc_id: str) -> Optional[dict]:
    """Get a specific document by ID"""
    metadata = await load_metadata()
    return metadata.get(doc_id)


async def delete_document(doc_id: str) -> bool:
    """Delete document and its metadata"""
    metadata = await load_metadata()

    if doc_id not in metadata:
        return False

    doc = metadata[doc_id]

    # Delete file from disk
    file_path = Path(doc["file_path"])
    if file_path.exists():
        file_path.unlink()

    # Delete text file from disk
    text_path = Path(doc["text_path"])
    if text_path.exists():
        text_path.unlink()

    # Remove from metadata
    del metadata[doc_id]
    await save_metadata(metadata)

    return True
