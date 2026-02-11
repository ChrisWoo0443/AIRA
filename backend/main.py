from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from ollama_client import check_ollama_status, test_completion

app = FastAPI(title="Research Agent API")

# Configure CORS for React frontend (Vite default port)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Research Agent API",
        "docs": "/docs",
        "endpoints": ["/health", "/api/ollama/status"]
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
        "recommendation": "llama3.2 or llama3.2-vision for document Q&A"
    }
