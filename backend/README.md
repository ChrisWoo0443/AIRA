# Research Agent Backend

FastAPI backend for Research Agent application.

## Prerequisites

- Python 3.11+
- pip

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload --port 8000
```

The server will start with auto-reload enabled on http://localhost:8000

## Test

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{"status": "ok", "service": "research-agent-api"}
```

## API Documentation

FastAPI provides auto-generated Swagger UI at:
- http://localhost:8000/docs
