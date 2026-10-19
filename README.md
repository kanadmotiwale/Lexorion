# Lexorion

A RAG knowledge assistant: upload documents, then ask questions and get grounded answers with source citations and a confidence score. Retrieval is **hybrid** (semantic vectors + keyword search, fused with Reciprocal Rank Fusion), and every answer is graded by a second LLM pass that re-ranks the evidence.

**Stack:** FastAPI · Supabase (Postgres + pgvector + Auth) · Groq (Llama 3.1) · HuggingFace / fastembed embeddings · React + Vite

---

## What it does

- **Chat with your documents** — answers are generated strictly from retrieved passages, with numbered sources and a confidence score.
- **Hybrid retrieval** — pgvector cosine similarity and Postgres full-text search are ranked independently, then merged with Reciprocal Rank Fusion. Semantic search handles paraphrases; keyword search catches exact names, IDs and rare terms that embeddings blur.
- **LLM evaluation + re-ranking** — an evaluator agent scores each retrieved chunk against the question and the generated answer, re-orders the sources and adjusts the confidence.
- **Semantic search panel** — search all your indexed content directly, results grouped by document.
- **Accounts and guests** — Supabase Auth for signed-in users (with saved conversation history); anonymous visitors get an isolated per-browser guest workspace.
- **Async ingestion** — uploads return immediately; parsing, chunking and embedding run in the background while the UI polls document status.

---

## Architecture

```
React (Vercel) ──► FastAPI (Render) ──► Supabase Postgres (pgvector + full-text)
                        │
                        ├──► HuggingFace Inference API / fastembed   (embeddings, 384-dim MiniLM)
                        └──► Groq                                    (answer generation + evaluation)
```

**Ingestion:** upload → parse (PyMuPDF / text) → chunk (512 tokens, 64 overlap, tiktoken) → embed (batched) → store chunks + vectors; a generated `tsvector` column feeds keyword search.

**Query:** embed question → vector top-N and full-text top-N (both scoped to the user) → Reciprocal Rank Fusion → top-K → Llama 3.1 answer → evaluator re-ranks sources and sets confidence.

---

## Project structure

```
lexorion/
├── backend/
│   ├── main.py                 # app, CORS, rate limiting, health
│   ├── auth.py                 # Supabase JWT verification (HS256 or JWKS) + guest IDs
│   ├── routes/                 # upload.py, chat.py, search.py, conversations.py
│   ├── services/
│   │   ├── etl.py              # parse → chunk → embed
│   │   ├── retriever.py        # hybrid / vector retrieval (pgvector + FTS + RRF)
│   │   ├── rag_chain.py        # prompt building + Groq generation
│   │   └── agent_eval.py       # LLM evaluation, re-ranking, confidence
│   ├── models/schemas.py       # Pydantic request/response models
│   └── db/database.py          # SQLAlchemy models, startup DDL and indexes
├── frontend/src/
│   ├── App.jsx
│   ├── api/client.js
│   ├── components/             # ChatPanel, UploadPanel, SearchPanel
│   └── pages/                  # LoginPage, SignupPage
└── render.yaml                 # backend deployment
```

---

## Getting started

### Prerequisites

- Python 3.10+, Node.js 18+, pnpm
- A [Supabase](https://supabase.com) project (free tier is fine) — enable the `vector` extension
- A [Groq](https://console.groq.com) API key (free tier is fine)
- Optional: a [HuggingFace](https://huggingface.co/settings/tokens) token for hosted embeddings. Without one, a local ONNX model (`fastembed`) is used instead.

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```
GROQ_API_KEY=...
HF_TOKEN=...                    # optional, falls back to local embeddings
DB_HOST=...                     # Supabase connection details
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASS=...
SUPABASE_JWT_SECRET=...         # for HS256 projects
SUPABASE_URL=https://xxxx.supabase.co   # for ES256/RS256 projects (JWKS)
FRONTEND_URL=http://localhost:5173
```

```bash
uvicorn main:app --reload --port 8000
```

Tables and indexes (HNSW vector index, GIN full-text index) are created automatically on startup. API docs are at `http://localhost:8000/docs`.

### Frontend

Create `frontend/.env`:

```
VITE_API_URL=http://localhost:8000/api/v1
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

```bash
cd frontend
pnpm install
pnpm dev
```

Open `http://localhost:5173`.

---

## API reference

All routes are under `/api/v1`. Send `Authorization: Bearer <supabase token>` or `X-Guest-Id: <uuid>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload a document (returns immediately, indexes in background) |
| GET | `/documents` | List your documents |
| GET | `/documents/{id}` | Document status (`processing` / `indexed` / `failed`) |
| DELETE | `/documents/{id}` | Delete a document and its chunks |
| POST | `/chat` | Ask a question (`mode`: `hybrid` or `vector`) |
| GET | `/search` | Semantic search (`query`, `top_k`, `score_threshold`, `file_type`, `mode`) |
| GET | `/search/document/{id}` | Search within one document |
| GET | `/search/stats` | Index statistics |
| GET | `/conversations` | List saved conversations (signed-in users) |
| GET | `/conversations/{id}/messages` | Messages in a conversation |
| DELETE | `/conversations/{id}` | Delete a conversation |

Supported files: `.pdf`, `.txt`, `.md` (max 10 MB).

---

## Configuration

| Setting | Where | Default |
|---------|-------|---------|
| Chunk size / overlap | `services/etl.py` | 512 / 64 tokens |
| Embedding model | `services/etl.py` | `all-MiniLM-L6-v2` (384-dim) |
| LLM / evaluator | `services/rag_chain.py`, `services/agent_eval.py` | `llama-3.1-8b-instant` |
| RRF constant, candidate pool | `services/retriever.py` | k=60, 4× top_k |
| Rate limit | `main.py` | 60 req/min per IP |

Changing the embedding model requires re-indexing: vectors from different models are not comparable.

---

## Deployment

- **Backend → Render:** `render.yaml` defines the service. Set `GROQ_API_KEY`, `HF_TOKEN`, `DB_*`, `SUPABASE_JWT_SECRET` and `SUPABASE_URL` in the dashboard.
- **Frontend → Vercel:** import the repo, set the root to `frontend/`, and add the `VITE_*` variables.

---

## License

MIT
