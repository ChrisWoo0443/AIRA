ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def validate_file_extension(filename: str) -> bool:
    """Check if file extension is allowed"""
    return any(filename.lower().endswith(ext) for ext in ALLOWED_EXTENSIONS)


def validate_file_type_magic(file_path: str) -> bool:
    """Validate file type using magic bytes (file signatures)"""
    try:
        with open(file_path, 'rb') as f:
            header = f.read(4)

        # PDF signature: %PDF (0x25 0x50 0x44 0x46)
        if header.startswith(b'%PDF'):
            return True

        # Text files: check if content is valid UTF-8
        # Read more bytes for text validation
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                f.read(1024)  # Try to read first 1KB as UTF-8
            return True
        except UnicodeDecodeError:
            return False

    except Exception:
        return False
