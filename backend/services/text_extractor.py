import pymupdf
import aiofiles


def extract_pdf_text(file_path: str) -> str:
    """Extract text from PDF using PyMuPDF"""
    try:
        doc = pymupdf.open(file_path)
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text())
        doc.close()
        return "\n".join(text_parts)
    except Exception:
        return ""


async def extract_text_file(file_path: str) -> str:
    """Extract text from text/markdown file"""
    try:
        async with aiofiles.open(file_path, mode='r', encoding='utf-8') as f:
            content = await f.read()
        return content
    except Exception:
        return ""


async def extract_text(file_path: str, extension: str) -> str:
    """Dispatcher that extracts text based on file extension"""
    if extension == ".pdf":
        return extract_pdf_text(file_path)
    elif extension in {".txt", ".md"}:
        return await extract_text_file(file_path)
    return ""
