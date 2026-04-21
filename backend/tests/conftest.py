"""
Shared test fixtures and module mocking for backend tests.

Mocks external dependencies (ollama, chromadb, FlagEmbedding) at the
sys.modules level so service modules can be imported without these
packages installed. Skips mocking for packages that are actually
available in the test environment.
"""

import importlib
import sys
from unittest.mock import MagicMock

# Mock external packages that are not installed in test venv
# These must be set before any service module is imported
# Skip mocking for packages that are actually importable
_PACKAGES_TO_MOCK = [
    "ollama",
    "chromadb",
    "chromadb.config",
    "FlagEmbedding",
    "langchain_text_splitters",
    "aiofiles",
    "fitz",
    "pymupdf",
    "slowapi",
    "slowapi.errors",
    "slowapi.middleware",
    "slowapi.util",
    "sqlalchemy",
    "sqlalchemy.orm",
]

for module_name in _PACKAGES_TO_MOCK:
    if module_name not in sys.modules:
        # Check if the package is actually installed before mocking
        top_level = module_name.split(".")[0]
        try:
            importlib.import_module(top_level)
        except ImportError:
            sys.modules[module_name] = MagicMock()
