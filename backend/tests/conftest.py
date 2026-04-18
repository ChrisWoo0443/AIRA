"""
Shared test fixtures and module mocking for backend tests.

Mocks external dependencies (ollama, chromadb, FlagEmbedding) at the
sys.modules level so service modules can be imported without these
packages installed.
"""

import sys
from unittest.mock import MagicMock

# Mock external packages that are not installed in test venv
# These must be set before any service module is imported
for module_name in [
    "ollama",
    "chromadb",
    "chromadb.config",
    "FlagEmbedding",
    "langchain_text_splitters",
    "aiofiles",
    "fitz",
    "slowapi",
    "slowapi.errors",
    "slowapi.middleware",
    "slowapi.util",
    "sqlalchemy",
    "sqlalchemy.orm",
]:
    if module_name not in sys.modules:
        sys.modules[module_name] = MagicMock()
