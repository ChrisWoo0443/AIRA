# Testing — AIRA

Current state of automated testing. **Frontend: present (Vitest). Backend: absent — this is a blocker for safe RAG refactor.**

---

## Frontend

### Framework
- **Vitest** (jsdom environment) with **React Testing Library**
- Config in `vite.config.ts` / `vitest` section
- Setup file: `frontend/src/__tests__/setup.ts`

### Layout
```
frontend/src/__tests__/
├── setup.ts                    jest-dom matchers + any globals
├── ChatInput.test.tsx
├── MessageList.test.tsx
├── ModelSelector.test.tsx
├── useChatSessions.test.ts
└── useDocumentPanel.test.ts
```

### Patterns in use
- **Component tests:** `render(<Component ... />)` + `screen.getBy*` queries
- **User interactions:** `userEvent` preferred over `fireEvent` where practical
- **Hook tests:** `renderHook(() => useHook())` with `act(() => setter(...))`
- **Mocks:** `vi.mock('path/to/module', () => ({ ... }))` for API + localStorage
- **Assertions:** `expect(el).toBeInTheDocument()`, `toHaveTextContent`, `toHaveAttribute`

### Coverage
- Component-level: `ChatInput`, `MessageList`, `ModelSelector` (happy path + a few edge cases)
- Hook-level: `useChatSessions`, `useDocumentPanel`
- **Missing:** `Chat.tsx` (SSE stream handling), `FileUpload.tsx`, `DocumentContextSelector.tsx`, `api.ts` (fetch wrapper), any end-to-end flow

### Run
- `npm test` (via Vitest) — from `frontend/`

---

## Backend — NONE (critical gap)

No test framework is installed in `backend/requirements.txt`. No `tests/` directory. No `pytest.ini` / `pyproject.toml` test config. Zero automated coverage.

This is the **single largest risk for the upcoming RAG accuracy work** — every change to retrieval, chunking, or generation ships unverified.

### Recommended stack (to add)
- `pytest` + `pytest-asyncio` — async test support
- `httpx` — async HTTP client for FastAPI test client
- `pytest-mock` — convenience wrapper over `unittest.mock`
- `respx` or `pytest-httpx` — mock Ollama HTTP calls (avoid hitting a real Ollama in CI)

### Recommended layout
```
backend/tests/
├── conftest.py                 shared fixtures (tmp ChromaDB path, fake ollama, db session)
├── unit/
│   ├── test_chunking_service.py
│   ├── test_embedding_service.py
│   ├── test_retrieval_service.py
│   ├── test_rag_service.py
│   ├── test_file_validator.py
│   └── test_text_extractor.py
├── integration/
│   ├── test_documents_api.py   upload → retrieval round-trip
│   ├── test_chat_api.py        /api/chat SSE with mocked Ollama
│   └── test_search_api.py
└── fixtures/
    ├── sample.pdf
    └── sample.md
```

### Priority tests (order matters — these gate the RAG refactor)
1. **`test_retrieval_service.py`** — locks in current behavior of `search_documents` (top-k, scoring, doc_id filter) so reranking/hybrid can be added regression-safely.
2. **`test_rag_service.py`** — prompt construction + source assembly + streaming contract.
3. **`test_chunking_service.py`** — chunk count, size, overlap invariants; pins the current splitter so alternatives can be compared on the same corpus.
4. **`test_embedding_service.py`** — happy path + Ollama error propagation (connection refused, model missing).
5. **`test_documents_api.py`** — end-to-end upload with a small fixture PDF; asserts metadata + vector count.

### Mocking Ollama
Real Ollama in CI is flaky and slow. Prefer `respx` or a fake `OllamaClient` injected via FastAPI `Depends`. Record a few embedding vectors as fixtures (JSON) so retrieval tests are deterministic.

### Coverage target
80%+ on services/; 60%+ on API layer; integration tests cover the happy paths.

---

## Test infrastructure gaps

- No CI configuration committed (`.github/workflows/` absent)
- No coverage reporter
- No pre-commit hook running tests
- Frontend test run is not gated by anything

For the RAG refactor: add pytest + five priority test files **before** any service-layer change. Treat this as Phase 1 of the roadmap.
