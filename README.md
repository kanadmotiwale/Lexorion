# Lexorion

A RAG-based AI knowledge assistant that lets you upload documents and have real conversations with them. Built with FastAPI, FAISS, and Ollama — no cloud AI costs, runs entirely on your machine.

---

## What it does

You upload PDFs, text files, or markdown documents. Lexorion parses them, breaks them into chunks, embeds them using a local model, and stores the vectors in a FAISS index. When you ask a question, it retrieves the most relevant chunks, passes them to a local LLM, and gives you a grounded answer with source citations and a confidence score.

There's also a semantic search panel where you can search directly across all your indexed content without going through the LLM — useful when you just want to find a specific section fast.

---

## Stack

**Backend**
- FastAPI — REST API with three main routes: `/chat`, `/upload`, `/search`
- FAISS — vector store for semantic similarity search
- Ollama — local LLM inference (`llama3.2`) and embeddings (`nomic-embed-text`)
- PyMuPDF — PDF parsing
- Pydantic AI — multi-agent evaluation and re-ranking
- SQLite — document metadata and chunk records
- tiktoken — tokenization and chunking

**Frontend**
- React + Vite
- Axios for API calls
- No UI library — all custom components

---

## Project structure

```
lexorion/
├── backend/
│   ├── main.py
│   ├── routes/
│   │   ├── chat.py
│   │   ├── upload.py
│   │   └── search.py
│   ├── services/
│   │   ├── etl.py          # parse → chunk → embed
│   │   ├── retriever.py    # FAISS index management
│   │   ├── rag_chain.py    # retrieval + generation
│   │   └── agent_eval.py   # re-ranking + confidence scoring
│   ├── models/
│   │   └── schemas.py
│   ├── db/
│   │   └── database.py
│   └── requirements.txt
└── frontend/
    └── src/
        ├── App.jsx
        ├── api/
        │   └── client.js
        └── components/
            ├── ChatPanel.jsx
            ├── UploadPanel.jsx
            └── SearchPanel.jsx
```

---

## Getting started

### Prerequisites

- Python 3.10+
- Node.js 18+
- pnpm
- [Ollama](https://ollama.com) installed

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/lexorion.git
cd lexorion
```

### 2. Start Ollama and pull models

```bash
ollama serve
```

In a new terminal:

```bash
ollama pull nomic-embed-text
ollama pull llama3.2
```

### 3. Set up the backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` folder:

```
OPENAI_API_KEY=not-needed-using-ollama
```

Start the backend:

```bash
uvicorn main:app --reload --port 8000
```

The API will be running at `http://localhost:8000`. You can explore all endpoints at `http://localhost:8000/docs`.

### 4. Set up the frontend

```bash
cd ../frontend
pnpm install
pnpm dev
```

Open `http://localhost:5173` in your browser.

---

## How the RAG pipeline works

1. **Upload** — file is saved to disk and a record is created in SQLite with status `processing`
2. **Parse** — PyMuPDF extracts text from PDFs; plain text reader handles TXT and MD
3. **Chunk** — text is split into 512-token chunks with a 64-token overlap using tiktoken
4. **Embed** — each chunk is embedded using `nomic-embed-text` via Ollama
5. **Index** — embeddings are normalized and added to a FAISS flat index; metadata stored in SQLite
6. **Query** — user question is embedded → FAISS returns top-K chunks → chunks passed to `llama3.2` with a prompt template → answer generated
7. **Evaluate** — Pydantic AI agent scores chunk relevance, re-ranks results, and adjusts the confidence score

---

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/upload` | Upload and index a document |
| GET | `/api/v1/documents` | List all indexed documents |
| DELETE | `/api/v1/documents/{id}` | Delete a document |
| POST | `/api/v1/chat` | Ask a question |
| GET | `/api/v1/search` | Semantic search across chunks |
| GET | `/api/v1/search/stats` | FAISS index stats |

---

## Supported file types

| Format | Extension |
|--------|-----------|
| PDF | `.pdf` |
| Plain text | `.txt` |
| Markdown | `.md` |

Max file size: 10MB

---

## Configuration

Chunking behavior can be adjusted in `backend/services/etl.py`:

```python
CHUNK_SIZE = 512      # tokens per chunk
CHUNK_OVERLAP = 64    # overlap between chunks
```

The LLM and embedding models can be swapped in the same file and in `rag_chain.py`:

```python
EMBEDDING_MODEL = "nomic-embed-text"
LLM_MODEL = "llama3.2"
```

---

## Deployment

**Frontend → Vercel**

```bash
cd frontend
pnpm build
# push to GitHub, then import repo on vercel.com
```

**Backend → Render**

- Create a new Web Service on render.com
- Point it to the `backend/` folder
- Set build command: `pip install -r requirements.txt`
- Set start command: `uvicorn main:app --host 0.0.0.0 --port 8000`

Note: Ollama cannot run on Render's free tier. For cloud deployment, swap Ollama for the OpenAI API by updating `etl.py`, `rag_chain.py`, and `agent_eval.py` to use the OpenAI client.

---

## License

MIT