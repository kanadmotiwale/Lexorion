import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from db.database import init_db
from routes import upload, chat, search

load_dotenv()

# --- App init ---

app = FastAPI(
    title="Lexorion API",
    description="RAG-based AI Knowledge Assistant",
    version="1.0.0",
)

# --- CORS ---

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://localhost:3000",
        os.getenv("FRONTEND_URL", "*"),  # Production frontend URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Startup ---

@app.on_event("startup")
async def startup_event():
    init_db()
    os.makedirs("uploads", exist_ok=True)
    os.makedirs("faiss_index", exist_ok=True)
    print("✅ Lexorion API started")
    print(f"📦 Database initialized")
    print(f"🔍 FAISS index ready")


# --- Routes ---

app.include_router(upload.router, prefix="/api/v1", tags=["documents"])
app.include_router(chat.router, prefix="/api/v1", tags=["chat"])
app.include_router(search.router, prefix="/api/v1", tags=["search"])


# --- Root ---

@app.get("/")
def root():
    return {
        "name": "Lexorion",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


# --- Health ---

@app.get("/health")
def health():
    return {"status": "healthy", "service": "lexorion-api"}