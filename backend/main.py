from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint for integration testing"""
    return {
        "status": "ok",
        "service": "research-agent-api"
    }
