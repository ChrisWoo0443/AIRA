"""
Ollama client utility for Research Agent backend.

Provides functions to check Ollama service status and test completions.
"""

import ollama
from typing import Dict, Any, List


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
        if hasattr(response, 'models'):
            models = [model.model for model in response.models]

        return {
            "status": "connected",
            "models": models
        }
    except Exception as e:
        return {
            "status": "disconnected",
            "models": [],
            "error": str(e)
        }


def test_completion(model: str = "llama3.2") -> Dict[str, Any]:
    """
    Test Ollama completion with a simple prompt.

    Args:
        model: Model name to use (default: llama3.2)

    Returns:
        dict: Completion result with keys:
            - success: bool indicating if completion succeeded
            - response: completion text (if successful)
            - model: model name used
            - error: error message (if failed)
    """
    try:
        # Test with a simple math prompt
        response = ollama.chat(
            model=model,
            messages=[{
                "role": "user",
                "content": "What is 2+2? Answer with just the number."
            }]
        )

        # Extract response text
        response_text = response.get('message', {}).get('content', '')

        return {
            "success": True,
            "response": response_text.strip(),
            "model": model
        }
    except Exception as e:
        return {
            "success": False,
            "response": "",
            "model": model,
            "error": str(e)
        }
