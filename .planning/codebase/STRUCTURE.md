# Structure — AIRA

Repo layout, key locations, and where to find each RAG pipeline stage.

---

## Top-level

```
AIRA/
├── backend/              FastAPI + Ollama + ChromaDB
├── frontend/             React 19 + Vite + TypeScript + Tailwind
├── docs/                 Project docs (gitignored per user convention)
├── .planning/            GSD workflow artifacts
├── .gitignore
└── README.md (if present)
```

---

## Backend layout

```
backend/
├── main.py                     FastAPI app, CORS, lifespan, router mounts
├── ollama_client.py            Ollama wrapper (embed + chat_stream)
├── rate_limiter.py             SlowAPI Limiter instance
├── validators.py               Shared pydantic validators
├── sessions.db                 SQLite (runtime, gitignored)
├── uploads/                    File + vector storage (runtime, gitignored)
│   ├── metadata.json           Document metadata index
│   ├── text/                   Extracted plain text per doc_id
│   └── vectors/                ChromaDB persistent directory
│
├── api/                        Thin HTTP handlers
│   ├── __init__.py
│   ├── chat.py                 /api/chat (SSE streaming), sessions CRUD
│   ├── documents.py            /api/documents upload, list, delete
│   └── search.py               /api/search standalone retrieval
│
├── models/                     Pydantic request/response + SQLAlchemy ORM
│   ├── __init__.py
│   ├── document.py             DocumentMetadata, UploadResponse
│   ├── search.py               SearchRequest, SearchResult
│   └── session.py              SQLAlchemy ChatSession; Pydantic ChatRequest etc.
│
└── services/                   Domain / orchestration logic
    ├── __init__.py
    ├── file_validator.py       Extension + magic-byte validation
    ├── text_extractor.py       PyMuPDF for PDF, raw read for TXT/MD
    ├── chunking_service.py     RecursiveCharacterTextSplitter (512/51)
    ├── embedding_service.py    Ollama embed wrapper (nomic-embed-text)
    ├── vector_service.py       ChromaDB persistent collection ops
    ├── retrieval_service.py    Query embed + vector query + scoring
    ├── rag_service.py          Prompt build + streaming generation
    ├── document_service.py     uploads/metadata.json CRUD (asyncio.Lock)
    └── session_service.py      SQLAlchemy session + message persistence
```

**File sizes** (rough gauge):
- Largest: `chat.py` (196), `ollama_client.py` (146), `main.py` (143), `rag_service.py` (135)
- Smallest: `rate_limiter.py` (10), `chunking_service.py` (36)
- Total backend Python: ~1,600 lines

---

## Frontend layout

```
frontend/
├── index.html
├── vite.config.ts
├── package.json
├── tsconfig*.json
├── tailwind.config.js / postcss.config.js
│
└── src/
    ├── main.tsx                  React entry
    ├── App.tsx                   Root layout composition
    ├── index.css / App.css       Tailwind + custom CSS vars
    │
    ├── components/
    │   ├── Chat.tsx              Chat surface; SSE reader; message routing
    │   ├── ChatInput.tsx         Input + send button
    │   ├── MessageList.tsx       Message rendering + markdown
    │   ├── ChatList.tsx          Session list sidebar
    │   ├── DocumentList.tsx      Uploaded documents display
    │   ├── DocumentContextSelector.tsx  Scope chat to selected docs
    │   ├── FileUpload.tsx        Drag/drop + progress
    │   ├── FileTypeBadge.tsx
    │   ├── ModelSelector.tsx     Pick Ollama chat model
    │   └── layout/
    │       ├── Layout.tsx        Shell
    │       ├── IconRail.tsx      Left nav
    │       └── DocumentPanel.tsx Right panel (documents)
    │
    ├── hooks/
    │   ├── useChatSessions.ts    Session CRUD + localStorage
    │   ├── useDocumentPanel.ts   Panel open/close + selection state
    │   └── useLocalStorage.ts    Generic persisted state hook
    │
    ├── services/
    │   └── api.ts                Fetch client; centralized base URL
    │
    ├── types/
    │   ├── chat.ts               Message, ChatRequest, SSE event types
    │   ├── chatSession.ts        Session shape
    │   └── document.ts           DocumentMetadata, UploadResponse
    │
    └── __tests__/                Vitest + React Testing Library
        ├── setup.ts
        ├── ChatInput.test.tsx
        ├── MessageList.test.tsx
        ├── ModelSelector.test.tsx
        ├── useChatSessions.test.ts
        └── useDocumentPanel.test.ts
```

---

## Where each RAG pipeline stage lives

| Stage | File | Key symbol |
|---|---|---|
| Upload intake | `backend/api/documents.py` | `upload_document` |
| File validation | `backend/services/file_validator.py` | `validate_file` |
| Text extraction | `backend/services/text_extractor.py` | `extract_text` |
| Chunking | `backend/services/chunking_service.py` | `chunk_text` |
| Embedding | `backend/services/embedding_service.py` | `embed_text`, `embed_batch` |
| Vector store write | `backend/services/vector_service.py` | `add_vectors`, `delete_by_doc_id` |
| Metadata store | `backend/services/document_service.py` | `add_document`, `list_documents` |
| Query embedding | `backend/services/retrieval_service.py` | `search_documents` |
| Retrieval / scoring | `backend/services/retrieval_service.py` | `_score` (1/(1+dist)) |
| Prompt construction | `backend/services/rag_service.py` | `_build_messages` |
| Streaming generation | `backend/services/rag_service.py` | `generate_rag_response` |
| Ollama transport | `backend/ollama_client.py` | `OllamaClient.chat_stream`, `embed` |
| Session persistence | `backend/services/session_service.py` | `SessionService` |

---

## `uploads/` layout (runtime, gitignored)

```
backend/uploads/
├── metadata.json           [ { doc_id, filename, size, chunk_count, uploaded_at }, ... ]
├── text/
│   └── {doc_id}.txt        Extracted plaintext, one file per document
└── vectors/                ChromaDB persistent directory
    ├── chroma.sqlite3
    └── {collection-uuid}/
        ├── data_level0.bin
        ├── length.bin
        ├── link_lists.bin
        └── header.bin
```

Chunk IDs follow the pattern `{doc_id}-{chunk_index}`.

Chunk metadata stored alongside each vector:
```json
{ "doc_id": "uuid4", "filename": "paper.pdf", "chunk_index": 7, "total_chunks": 42 }
```

---

## Naming conventions

**Backend (Python):**
- `snake_case` for functions, variables, files
- `PascalCase` for classes + Pydantic models
- Service modules named `{domain}_service.py`
- Router files named after resource (`documents.py`, `chat.py`)

**Frontend (TypeScript/React):**
- `PascalCase.tsx` for components (one component per file)
- `camelCase.ts` for hooks (`use*`), services, utils
- `types/` holds interfaces, named `PascalCase`
- Test files mirror source name with `.test.tsx` / `.test.ts` under `__tests__/`

---

## Where to make RAG accuracy improvements

For the in-flight goal (improve retrieval accuracy), these are the touch points:

| Improvement | Primary file |
|---|---|
| Cross-encoder reranker | `backend/services/retrieval_service.py` (post-query filter) |
| Hybrid BM25 + dense | `backend/services/retrieval_service.py` + new `bm25_index.py` |
| Query rewriting | New `backend/services/query_rewriter.py`; call from `rag_service.py` |
| Better chunking | `backend/services/chunking_service.py` |
| Contextual retrieval | `backend/services/chunking_service.py` (augment at ingest) |
| Swap embedding model | `backend/services/embedding_service.py` + model config |
| Rerank config / threshold | Extend `models/search.py` request shape |

Backend tests landing zone (currently missing): `backend/tests/` with `test_retrieval_service.py`, `test_rag_service.py`, `test_chunking_service.py`.
