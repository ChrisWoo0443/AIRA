# AIRA – AI Research Assistant

AIRA is a full-stack app that turns your documents into a searchable, chat-based research assistant. Upload PDFs and text files, then ask questions in natural language. A FastAPI backend handles ingestion, embeddings, and RAG; a React frontend provides the UI; and [Ollama](https://ollama.ai) runs the LLM locally.

## Project structure

| Directory   | Stack              | Role |
|------------|--------------------|------|
| `frontend/` | React, TypeScript, Vite | Document management, model selector, chat UI |
| `backend/`  | FastAPI, SQLite, ChromaDB | API, document processing, embeddings, RAG, chat sessions |

## Features

- **Document management** – Upload, list, and delete documents (PDF, `.txt`, `.md`). Text is extracted, chunked, embedded, and stored for semantic search.
- **RAG search** – Query your documents with natural language; the API returns relevant chunks and uses them as context for answers.
- **Chat** – Multi-turn chat with streaming responses. Sessions are stored in SQLite and can be resumed; history is persisted in the browser.
- **Model selection** – Pick which Ollama model to use for chat from the UI or via the API.
- **API docs** – OpenAPI/Swagger at `/docs` when the backend is running.

## Prerequisites

- **Node.js** 18+
- **Python** 3.11+
- **Ollama** – [Install](https://ollama.ai) and pull a model
- **npm** (or yarn/pnpm)

## Quick start

### 1. Ollama

Install Ollama and pull a model:

```bash
ollama pull qwen3:8b
```

### 2. Backend

From the project root:

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API: `http://localhost:8000`

### 3. Frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:5173`. The dev server proxies `/api` to the backend.

## API overview

When the backend is running, interactive docs: **http://localhost:8000/docs**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/ollama/status` | GET | Ollama connection and model list |
| `/api/models` | GET | List available Ollama models |
| `/api/model/select` | POST | Set the model used for chat (body: `{"model_name": "qwen3:8b"}`) |
| `/api/documents` | GET | List uploaded documents |
| `/api/documents/upload` | POST | Upload a document (PDF, .txt, .md) |
| `/api/documents/{id}` | DELETE | Delete a document and its vectors |
| `/api/search` | GET | Semantic search (`q`, `top_k`, optional `doc_ids`) |
| `/api/chat/session/new` | POST | Create a chat session |
| `/api/chat/session/{id}` | GET / DELETE | Get or delete a session |
| `/api/chat/message` | POST | Send a message (streaming SSE response) |

## How it works

1. **Upload** – You upload a file; the backend extracts text, splits it into chunks, generates embeddings (Ollama `nomic-embed-text`), and stores them in ChromaDB.
2. **Search** – A query is embedded and compared to stored chunks; the most relevant chunks are returned (and optionally passed to the LLM).
3. **Chat** – Each message triggers retrieval over your documents; the retrieved context plus the conversation is sent to the selected Ollama model, and the reply is streamed back via SSE. Sessions and messages are stored in SQLite.

## Development

- **Backend:** `uvicorn main:app --reload` (run from `backend/`).
- **Frontend:** `npm run dev` (run from `frontend/`).

Both support hot reload.

## Production build (frontend)

```bash
cd frontend
npm run build
```

Output is in `frontend/dist/`. Serve it with any static host; ensure requests to `/api` are proxied to the FastAPI backend.

## License

MIT
