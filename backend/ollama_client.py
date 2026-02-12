"""
Ollama client utility for Research Agent backend.

Provides functions to check Ollama service status and test completions.
Supports configurable model selection.
"""

import ollama
from typing import Dict, Any, List, AsyncGenerator, Optional


# Default model configuration
DEFAULT_MODEL = "llama3:8b"
_selected_model = DEFAULT_MODEL


def set_selected_model(model_name: str):
    """
    Set the globally selected model for Ollama operations.

    Args:
        model_name: Name of the model to use
    """
    global _selected_model
    _selected_model = model_name


def get_selected_model() -> str:
    """
    Get the currently selected model.

    Returns:
        str: Name of the currently selected model
    """
    return _selected_model


def check_ollama_status() -> Dict[str, Any]:
    """
    Check if Ollama service is accessible and list available models.

    Returns:
        dict: Status information with keys:
            - status: "connected" | "disconnected"
            - models: list of available model names (if connected)
            - error: error message (if disconnected)
    """
    try:
        # Attempt to list models to verify Ollama is accessible
        response = ollama.list()

        # Extract model names from response
        models = []
        if hasattr(response, "models"):
            models = [model.model for model in response.models]

        return {"status": "connected", "models": models}
    except Exception as e:
        return {"status": "disconnected", "models": [], "error": str(e)}


def test_completion(model: Optional[str] = None) -> Dict[str, Any]:
    """
    Test Ollama completion with a simple prompt.

    Args:
        model: Model name to use (default: selected model or llama3:8b)

    Returns:
        dict: Completion result with keys:
            - success: bool indicating if completion succeeded
            - response: completion text (if successful)
            - model: model name used
            - error: error message (if failed)
    """
    # Use provided model or fallback to selected model
    model_to_use: str = model if model is not None else _selected_model
    try:
        # Test with a simple math prompt
        response = ollama.chat(
            model=model_to_use,
            messages=[
                {"role": "user", "content": "What is 2+2? Answer with just the number."}
            ],
        )

        # Extract response text
        response_text = response.get("message", {}).get("content", "")

        return {
            "success": True,
            "response": response_text.strip(),
            "model": model_to_use,
        }
    except Exception as e:
        return {
            "success": False,
            "response": "",
            "model": model_to_use,
            "error": str(e),
        }


async def stream_chat_completion(
    messages: List[Dict[str, str]], model: Optional[str] = None
) -> AsyncGenerator[str, None]:
    """
    Stream chat completion from Ollama.

    Args:
        messages: List of message dicts with 'role' and 'content' keys
        model: Model name to use (default: selected model or llama3:8b)

    Yields:
        str: Content chunks from the streaming response

    Raises:
        Exception: If Ollama request fails
    """
    # Use provided model or fallback to selected model
    model_to_use: str = model if model is not None else _selected_model

    client = ollama.AsyncClient()

    try:
        stream = await client.chat(model=model_to_use, messages=messages, stream=True)

        async for chunk in stream:
            # Extract content from chunk
            if isinstance(chunk, dict):
                content = chunk.get("message", {}).get("content", "")
            else:
                # Handle object-style response
                content = (
                    getattr(chunk.get("message", {}), "content", "")
                    if hasattr(chunk, "get")
                    else ""
                )
                if not content and hasattr(chunk, "message"):
                    content = getattr(chunk.message, "content", "")

            if content:
                yield content

    except Exception as e:
        raise Exception(f"Ollama streaming error: {str(e)}") from e
