"""
Shared input validators for API endpoints.
"""

import re
from uuid import UUID

MODEL_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9._:\-/]+$")


def validate_model_name(name: str) -> str:
    """Validate that a model name contains only allowed characters."""
    if not MODEL_NAME_PATTERN.match(name):
        raise ValueError(
            "Model name contains invalid characters. "
            "Allowed: alphanumeric, '.', '_', ':', '-', '/'"
        )
    return name


def validate_uuid(value: str) -> str:
    """Validate that a string is a valid UUID format."""
    try:
        UUID(value)
    except (ValueError, AttributeError):
        raise ValueError(f"Invalid UUID format: {value}")
    return value
