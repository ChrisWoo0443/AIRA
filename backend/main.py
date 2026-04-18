from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from starlette.requests import Request
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from ollama_client import check_ollama_status, test_completion
from rate_limiter import limiter
from services.reranker_service import get_reranker_status
from services.bm25_index_service import get_bm25_status
from validators import validate_model_name as _validate_model_name
from api.documents import router as documents_router
from api.search import router as search_router
from api.chat import router as chat_router

app = FastAPI(title="Research Agent API")

# Configure rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Configure CORS for React frontend (Vite default port)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers under /api
app.include_router(documents_router, prefix="/api")
app.include_router(search_router, prefix="/api")
app.include_router(chat_router, prefix="/api")


class ModelSelection(BaseModel):
    """Request body for model selection"""

    model_name: str = Field(..., min_length=1, max_length=100)

    @field_validator("model_name")
    @classmethod
    def check_model_name(cls, v):
        return _validate_model_name(v)


@app.post("/api/model/select")
@limiter.limit("20/minute")
async def select_model(request: Request, body: ModelSelection):
    """
    Select the model to use for completions.

    Args:
        request: ModelSelection with model_name

    Returns:
        dict: Confirmation of model selection
    """
    # Validate that the model exists by trying to get it
    try:
        import ollama

        # Try to show the model details to verify it exists
        ollama.show(body.model_name)
    except Exception:
        raise HTTPException(
            status_code=400, detail=f"Model '{body.model_name}' not found in Ollama"
        )

    # Store the selected model globally
    from ollama_client import set_selected_model

    set_selected_model(body.model_name)

    return {
        "status": "success",
        "model": body.model_name,
        "message": f"Model '{body.model_name}' selected successfully",
    }


@app.get("/api/models")
@limiter.limit("120/minute")
async def list_models(request: Request):
    """
    List available models in Ollama.

    Returns:
        dict: List of available models
    """
    try:
        import ollama

        response = ollama.list()
        models = (
            [model.model for model in response.models]
            if hasattr(response, "models")
            else []
        )
        return {"models": models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list models: {str(e)}")


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Research Agent API",
        "docs": "/docs",
        "endpoints": ["/health", "/api/ollama/status", "/search", "/chat"],
    }


@app.get("/health")
async def health_check():
    """Health check endpoint with component readiness reporting."""
    return {
        "status": "ok",
        "service": "research-agent-api",
        "components": {
            "reranker": get_reranker_status(),
            "bm25": get_bm25_status(),
        }
    }


@app.get("/api/ollama/status")
@limiter.limit("120/minute")
async def ollama_status(request: Request):
    """Check Ollama service status and run test completion"""
    # Check Ollama connection and list models
    status_info = check_ollama_status()

    # If connected, run test completion with selected model
    test_result = {}
    if status_info["status"] == "connected":
        from ollama_client import get_selected_model

        test_result = test_completion(get_selected_model())

    # Return combined status with model recommendation
    return {
        "ollama": status_info,
        "test": test_result
        if test_result
        else {"success": False, "error": "Ollama not connected"},
        "recommendation": "llama3:8b for document Q&A",
    }
