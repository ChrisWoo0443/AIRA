# Conventions — AIRA

Code style, naming, patterns, and error handling — for both `backend/` (Python/FastAPI) and `frontend/` (React 19 + TypeScript).

---

## Backend (Python 3.11+, FastAPI)

### Naming
- `snake_case` for functions, variables, module filenames
- `PascalCase` for classes and Pydantic models
- Service modules always named `{domain}_service.py` (e.g., `retrieval_service.py`)
- Router modules named after the resource (e.g., `documents.py`, `chat.py`)
- Private helpers prefixed with `_` (e.g., `_score`, `_build_messages`)

### Type hints (always)
- Every function signature uses type hints
- Imports from `typing`: `Optional`, `Dict`, `List`, `AsyncGenerator`, `Any`
- Pydantic `BaseModel` subclasses with `Field(...)` for validation
- Example pattern (services/retrieval_service.py):
  ```python
  async def search_documents(
      self, query: str, top_k: int = 5, doc_ids: Optional[List[str]] = None
  ) -> List[Dict[str, Any]]:
      ...
  ```

### Async patterns
- All I/O-bound service methods are `async def`
- File I/O via `aiofiles`
- Streaming generators via `AsyncGenerator[str, None]` (SSE in `rag_service.py`)
- `asyncio.Lock` guards the `metadata.json` file in `document_service.py`
- Sync Ollama/Chroma calls are OK inside async handlers — the project doesn't yet offload to a threadpool

### FastAPI patterns
- Routers constructed at module level: `router = APIRouter(prefix="/api/documents", tags=["documents"])`
- Decorator stack order: `@router.post(...)` → `@limiter.limit(...)`
- Path operations receive `Request` when rate-limited (SlowAPI requires it)
- Dependencies injected via `Depends()` (e.g., DB session)
- Errors raised as `HTTPException(status_code=..., detail=...)`

### Pydantic models
- Request/response models live in `backend/models/`
- Use `Field(default, description=..., gt=0, le=20)` rather than bare defaults
- `field_validator` for custom validation (e.g., strip whitespace on query)

### SQLAlchemy 2.0 style
- Declarative base + typed columns
- Async session not in use today; `Session` from `sqlalchemy.orm` with sync engine
- Models defined in `backend/models/session.py`

### Error handling
- Service layer **raises**; API layer catches and maps to HTTP errors
- Today's reality is inconsistent — some try/except blocks log and swallow (e.g., `api/documents.py:108`), some return `None`, some re-raise. This is flagged as tech debt in `CONCERNS.md §6.3`.
- Preferred pattern going forward: raise a typed exception in services, catch once at the router boundary.

### Logging
- Stdlib `logging` via `logger = logging.getLogger(__name__)`
- Only `warning`-level usage today (2-3 call sites). Info/debug paths are silent.
- No structured logger wired up (flagged in `CONCERNS.md §5.1`).

### Imports
- Order: stdlib → third-party → local (blank line between groups)
- No wildcard imports
- Relative imports inside `backend/` (`from .services.rag_service import ...`)

---

## Frontend (React 19, TypeScript strict, Vite, Tailwind)

### Naming
- Components: `PascalCase.tsx`, one component per file
- Hooks: `useCamelCase.ts`, prefix `use` is mandatory
- Services/utils: `camelCase.ts`
- Types/interfaces: `PascalCase`, in `src/types/`
- Test files mirror source: `Component.test.tsx` / `hook.test.ts` under `src/__tests__/`

### Components
- Functional components only; no class components
- Props typed inline: `interface ChatInputProps { ... }` then `function ChatInput(props: ChatInputProps)`
- Explicit return type `: JSX.Element` not required but common
- Co-located small helpers inside the component file

### Hooks
- State: `useState<Type>(initial)` with explicit generic
- Memoization: `useCallback` for stable handlers passed to children; `useMemo` for expensive derived values
- Effects: single responsibility per `useEffect`; cleanup returned
- Custom hooks return tuple `[value, setter]` or object `{ value, setter, ... }` — both styles present; object is preferred for >2 returns

### State management
- Local component state via `useState`
- Cross-component state via custom hooks (`useChatSessions`, `useDocumentPanel`)
- Persistence via `useLocalStorage` generic hook (`src/hooks/useLocalStorage.ts`)
- No Redux / Zustand / Context beyond what's needed

### Event handling
- Typed: `React.ChangeEvent<HTMLInputElement>`, `React.KeyboardEvent<HTMLTextAreaElement>`, `React.FormEvent`

### Styling
- Tailwind utility classes in `className`
- CSS variables (in `index.css`) for theme colors; referenced via arbitrary values like `bg-[var(--bg-surface)]`
- No CSS modules, no styled-components

### API layer
- Single `src/services/api.ts` wraps `fetch`
- Base URL + JSON headers centralized
- Errors thrown as plain `Error` with response text; caller decides UX
- SSE parsed inline in `Chat.tsx` via `response.body!.getReader()` + `TextDecoder` loop

### TypeScript
- `"strict": true` in tsconfig
- No `any` in committed code (occasional `unknown` with narrowing)
- Prefer `interface` for object shapes, `type` for unions/aliases

### Imports
- Absolute imports not configured; all relative
- Order: React → third-party → internal components → internal hooks/services → types → styles

---

## Git hygiene (user-enforced)

Per user memory: commits are short and to the point. Never include Co-Authored-By trailers or any AI-tool mention. Never commit `docs/` files.

---

## Open conventions gaps

- No linter config committed for Python (no `ruff.toml`, no `.flake8`). Running one would surface inconsistencies — worth adding before the RAG refactor.
- Frontend ESLint config is present (Vite default).
- No Prettier config committed; formatting is ad-hoc.
- No pre-commit hooks.
