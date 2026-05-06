import os
import time
from collections import defaultdict
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from dotenv import load_dotenv

from db.database import init_db
from routes import upload, chat, search, conversations

load_dotenv()

app = FastAPI(
    title="Lexorion API",
    description="RAG-based AI Knowledge Assistant",
    version="1.0.0",
)

# ── CORS ────────────────────────────────────────────────────────────────────────
# Never use "*" with allow_credentials=True — browsers block it.
_frontend_url = os.getenv("FRONTEND_URL", "")
_allowed_origins = ["http://localhost:5173", "http://localhost:3000"]
if _frontend_url and _frontend_url != "*":
    _allowed_origins.append(_frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Rate limiting ───────────────────────────────────────────────────────────────
_rate_store: dict = defaultdict(list)
_RATE_LIMIT    = 60   # requests
_RATE_WINDOW   = 60   # seconds

class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        forwarded = request.headers.get("X-Forwarded-For")
        client_ip = (
            forwarded.split(",")[0].strip()
            if forwarded
            else (request.client.host if request.client else "unknown")
        )
        now          = time.time()
        window_start = now - _RATE_WINDOW
        _rate_store[client_ip] = [t for t in _rate_store[client_ip] if t > window_start]
        if len(_rate_store[client_ip]) >= _RATE_LIMIT:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down."},
            )
        _rate_store[client_ip].append(now)
        return await call_next(request)

app.add_middleware(RateLimitMiddleware)

@app.on_event("startup")
async def startup_event():
    init_db()
    print("✅ Lexorion API started")
    print("🗄️  Connected to Supabase PostgreSQL")
    print("🔍 pgvector ready for semantic search")
    print("⚡ Embedding model will load on first request")

app.include_router(upload.router,        prefix="/api/v1", tags=["documents"])
app.include_router(chat.router,          prefix="/api/v1", tags=["chat"])
app.include_router(search.router,        prefix="/api/v1", tags=["search"])
app.include_router(conversations.router, prefix="/api/v1", tags=["conversations"])

@app.get("/")
def root():
    return {"name": "Lexorion", "version": "1.0.0", "status": "running", "docs": "/docs"}

@app.get("/health")
def health():
    return {"status": "healthy", "service": "lexorion-api"}

@app.get("/warmup")
def warmup():
    from services.etl import get_embedding_model
    get_embedding_model()
    return {"status": "warmed up", "model": "BAAI/bge-small-en-v1.5"}
