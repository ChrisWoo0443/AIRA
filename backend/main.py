from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from ollama_client import check_ollama_status, test_completion
from api.documents import router as documents_router
from api.search import router as search_router
from api.chat import router as chat_router

app = FastAPI(title="Research Agent API")

# Configure CORS for React frontend (Vite default port)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(documents_router)
app.include_router(search_router)
app.include_router(chat_router)


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Research Agent API",
        "docs": "/docs",
        "endpoints": ["/health", "/api/ollama/status", "/search", "/chat"]
    }


@app.get("/health")
async def health_check():
    """Health check endpoint for integration testing"""
    return {
        "status": "ok",
        "service": "research-agent-api"
    }


@app.get("/api/ollama/status")
async def ollama_status():
    """Check Ollama service status and run test completion"""
    # Check Ollama connection and list models
    status_info = check_ollama_status()

    # If connected, run test completion
    test_result = {}
    if status_info["status"] == "connected":
        test_result = test_completion()

    # Return combined status with model recommendation
    return {
        "ollama": status_info,
        "test": test_result if test_result else {"success": False, "error": "Ollama not connected"},
        "recommendation": "llama3:8b for document Q&A"
    }
