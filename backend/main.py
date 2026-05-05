import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from db.database import init_db
from routes import upload, chat, search

load_dotenv()

app = FastAPI(
    title="Lexorion API",
    description="RAG-based AI Knowledge Assistant",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        os.getenv("FRONTEND_URL", "*"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    init_db()
    print("✅ Lexorion API started")
    print("🗄️  Connected to Supabase PostgreSQL")
    print("🔍 pgvector ready for semantic search")
    print("⚡ Embedding model will load on first request")

app.include_router(upload.router, prefix="/api/v1", tags=["documents"])
app.include_router(chat.router,   prefix="/api/v1", tags=["chat"])
app.include_router(search.router, prefix="/api/v1", tags=["search"])

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
