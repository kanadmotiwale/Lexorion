import uuid
from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from auth import get_user_id
from db.database import get_db, SessionLocal, Document, Chunk
from models.schemas import DocumentResponse, DocumentListResponse
from services.etl import run_etl

router = APIRouter()

ALLOWED_EXTENSIONS = {"pdf", "txt", "md"}
MAX_FILE_SIZE      = 10 * 1024 * 1024   # 10 MB


def get_file_type(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type .{ext} not supported. Allowed: {ALLOWED_EXTENSIONS}",
        )
    return ext


# ── Background ETL task ────────────────────────────────────────────────────────

def _run_etl_background(content: bytes, file_type: str, document_id: str) -> None:
    """Runs ETL in a background task with its own DB session so the HTTP
    response can be returned immediately without blocking on embedding."""
    db = SessionLocal()
    try:
        chunks = run_etl(content, file_type, document_id)

        for chunk in chunks:
            db.add(Chunk(
                id          = chunk["id"],
                document_id = document_id,
                chunk_index = chunk["chunk_index"],
                text        = chunk["text"],
                token_count = chunk["token_count"],
                embedding   = chunk["embedding"],
            ))

        doc = db.query(Document).filter(Document.id == document_id).first()
        if doc:
            doc.total_chunks = len(chunks)
            doc.status       = "indexed"
            db.commit()

    except Exception as e:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if doc:
            doc.status = "failed"
            db.commit()
    finally:
        db.close()


# ── Upload ─────────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file:             UploadFile        = File(...),
    background_tasks: BackgroundTasks   = None,
    db:               Session           = Depends(get_db),
    user_id:          Optional[str]     = Depends(get_user_id),
):
    effective_id = user_id or "anonymous"
    file_type    = get_file_type(file.filename)

    content = await file.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max size is 10 MB.")

    document_id = str(uuid.uuid4())

    doc = Document(
        id        = document_id,
        user_id   = effective_id,
        filename  = file.filename,
        file_type = file_type,
        file_size = len(content),
        status    = "processing",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Return immediately — ETL (parse + chunk + embed) runs in the background.
    # The client polls GET /documents/{id} until status → "indexed" | "failed".
    background_tasks.add_task(_run_etl_background, content, file_type, document_id)

    return doc


# ── List ───────────────────────────────────────────────────────────────────────

@router.get("/documents", response_model=DocumentListResponse)
def list_documents(
    db:      Session        = Depends(get_db),
    user_id: Optional[str] = Depends(get_user_id),
):
    effective_id = user_id or "anonymous"
    documents = (
        db.query(Document)
        .filter(Document.user_id == effective_id)
        .order_by(Document.created_at.desc())
        .all()
    )
    return DocumentListResponse(documents=documents, total=len(documents))


# ── Get one ────────────────────────────────────────────────────────────────────

@router.get("/documents/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: str,
    db:          Session        = Depends(get_db),
    user_id:     Optional[str] = Depends(get_user_id),
):
    effective_id = user_id or "anonymous"
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == effective_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


# ── Delete ─────────────────────────────────────────────────────────────────────

@router.delete("/documents/{document_id}")
def delete_document(
    document_id: str,
    db:          Session        = Depends(get_db),
    user_id:     Optional[str] = Depends(get_user_id),
):
    effective_id = user_id or "anonymous"
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == effective_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    db.query(Chunk).filter(Chunk.document_id == document_id).delete()
    db.delete(doc)
    db.commit()
    return {"message": f"Document {document_id} deleted successfully"}
