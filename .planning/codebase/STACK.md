# Technology Stack

**Analysis Date:** 2026-04-15

## Languages

**Backend:**
- Python 3 - Primary backend language for FastAPI REST API and RAG services

**Frontend:**
- TypeScript 5.9.3 - Type-safe frontend application with React
- JavaScript/JSX - JSX for React component definitions

## Runtime

**Backend Environment:**
- Python 3.x (minimum version inferred from FastAPI >=0.104.0 compatibility)
- uvicorn 0.24.0+ - ASGI server

**Frontend Environment:**
- Node.js with npm - Frontend package manager and build tooling

**Package Manager:**
- pip - Python dependency manager (backend)
  - Lockfile: `backend/requirements.txt` (present)
- npm - JavaScript dependency manager (frontend)
  - Lockfile: `frontend/package-lock.json` (expected, not explicitly read)

## Frameworks

**Core Backend:**
- FastAPI >=0.104.0 - RESTful API framework with automatic documentation
- uvicorn[standard] >=0.24.0 - ASGI application server

**Core Frontend:**
- React 19.2.0 - UI component library
- Vite 7.3.1 - Fast build tool and dev server with HMR

**Testing (Frontend):**
- Vitest 4.1.0 - Vite-native unit test runner
- Jest DOM 6.9.1 - DOM matchers for assertions
- React Testing Library 16.3.2 - React component testing utilities
- User Event 14.6.1 - User interaction simulation for tests

**Build & Dev Tools:**
- TypeScript 5.9.3 - Type checking and compilation
- ESLint 9.39.1 - Linting with typescript-eslint 8.48.0
- Tailwind CSS 4.1.18 - Utility-first CSS framework
- @tailwindcss/vite 4.1.18 - Vite integration for Tailwind

**Linting Plugins:**
- eslint-plugin-react-hooks 7.0.1 - React hooks rules
- eslint-plugin-react-refresh 0.4.24 - Fast refresh safety checks
- typescript-eslint 8.48.0 - TypeScript-specific linting rules

## Key Dependencies

**Critical Backend (RAG & Vector Search):**
- ollama >=0.1.0 - Python client for Ollama LLM and embeddings API
- chromadb >=0.4.0 - Vector database for document embeddings (persistent storage)
- langchain-text-splitters >=0.2.0 - Text chunking for RAG ingestion

**Backend Infrastructure:**
- sqlalchemy >=2.0.0 - ORM for SQLite session management
- python-multipart >=0.0.6 - Form data parsing for file uploads
- aiofiles >=23.2.1 - Async file I/O operations
- PyMuPDF >=1.23.0 - PDF text extraction

**Backend Quality & Safety:**
- slowapi >=0.1.9 - Rate limiting middleware

**Frontend Dependencies:**
- react-markdown 10.1.0 - Markdown rendering in chat
- react-syntax-highlighter 16.1.1 - Code block syntax highlighting
- react-dropzone 15.0.0 - File upload drag-and-drop
- lucide-react 0.577.0 - Icon library
- clsx 2.1.1 - Conditional classname utility
- remark-gfm 4.0.1 - GitHub-flavored markdown plugin

**Frontend DevDependencies:**
- @vitejs/plugin-react 5.1.1 - React fast refresh plugin for Vite
- @types/node 24.10.1 - Node.js type definitions
- @types/react 19.2.7 - React type definitions
- @types/react-dom 19.2.3 - React DOM type definitions
- @types/react-syntax-highlighter 15.5.13 - Syntax highlighter types
- jsdom 29.0.0 - DOM implementation for test environment
- globals 16.5.0 - Global variable type definitions

## Configuration

**Frontend Build Configuration:**
- `frontend/vite.config.ts` - Vite configuration with React and Tailwind plugins
  - Dev server proxy: `/api` → `http://localhost:8000` (backend)
  - React Fast Refresh enabled
  - Tailwind CSS Vite integration

**Frontend TypeScript Configuration:**
- `frontend/tsconfig.json` - References app and node configs
- `frontend/tsconfig.app.json` - Application-specific compiler options
  - Target: ES2022
  - Module: ESNext
  - Strict mode enabled
  - React JSX transform
  - DOM and DOM.Iterable libraries
- `frontend/tsconfig.node.json` - Build script TypeScript config

**Frontend Linting:**
- `frontend/eslint.config.js` - ESLint config with:
  - TypeScript ESLint recommended rules
  - React hooks rules
  - React refresh safety checks
  - Browser globals

**Backend Service Configuration:**
- `backend/main.py` - FastAPI app configuration
  - CORS configured for React dev server (localhost:5173)
  - Rate limiting via slowapi middleware
  - API routers under `/api` prefix
- `backend/requirements.txt` - Python dependencies (pinned or minimal versions)

## Platform Requirements

**Development:**
- Python 3.x interpreter
- Node.js runtime (for frontend)
- Ollama service running locally (default: http://localhost:11434 assumed)
- pip for Python package installation
- npm or yarn for JavaScript packages

**Runtime (Production/Deployment):**
- Python 3.x with uvicorn server
- Ollama service (local or remote)
- SQLite database support (built into Python)
- ChromaDB vector store (persistent directory: `backend/uploads/vectors`)

**External Runtime Dependencies:**
- Ollama 0.2.x+ server - Provides LLM inference and embeddings API
- ChromaDB - Vector database persisted to filesystem

---

*Stack analysis: 2026-04-15*
