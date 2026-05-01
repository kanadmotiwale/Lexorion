import os
import uuid
import aiofiles
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List

from db.database import get_db, Document, Chunk
from models.schemas import DocumentResponse, DocumentListResponse
from services.etl import run_etl
from services.retriever import add_chunks_to_index, delete_document_from_index

router = APIRouter()

UPLOAD_DIR = "uploads"
ALLOWED_EXTENSIONS = {"pdf", "txt", "md"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def get_file_type(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type .{ext} not supported. Allowed: {ALLOWED_EXTENSIONS}"
        )
    return ext


def ensure_upload_dir():
    os.makedirs(UPLOAD_DIR, exist_ok=True)


# --- Upload a document ---

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    ensure_upload_dir()

    # Validate file type
    file_type = get_file_type(file.filename)

    # Read file content
    content = await file.read()

    # Validate file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max size is 10MB."
        )

    # Generate document ID and save file
    document_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{document_id}.{file_type}")

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    # Create document record in DB
    doc = Document(
        id=document_id,
        filename=file.filename,
        file_type=file_type,
        file_size=len(content),
        status="processing",
    )
    db.add(doc)
    db.commit()

    try:
        # Run ETL pipeline
        chunks = run_etl(file_path, file_type, document_id)

        # Save chunks to SQLite
        for chunk in chunks:
            db_chunk = Chunk(
                id=chunk["id"],
                document_id=document_id,
                chunk_index=chunk["chunk_index"],
                text=chunk["text"],
                token_count=chunk["token_count"],
            )
            db.add(db_chunk)

        # Add embeddings to FAISS
        add_chunks_to_index(chunks)

        # Update document status
        doc.total_chunks = len(chunks)
        doc.status = "indexed"
        db.commit()

    except Exception as e:
        # Mark as failed
        doc.status = "failed"
        db.commit()

        # Clean up file
        if os.path.exists(file_path):
            os.remove(file_path)

        raise HTTPException(
            status_code=500,
            detail=f"ETL pipeline failed: {str(e)}"
        )

    db.refresh(doc)
    return doc


# --- List all documents ---

@router.get("/documents", response_model=DocumentListResponse)
def list_documents(db: Session = Depends(get_db)):
    documents = db.query(Document).order_by(Document.created_at.desc()).all()
    return DocumentListResponse(
        documents=documents,
        total=len(documents)
    )


# --- Get single document ---

@router.get("/documents/{document_id}", response_model=DocumentResponse)
def get_document(document_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


# --- Delete a document ---

@router.delete("/documents/{document_id}")
def delete_document(document_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove from FAISS
    delete_document_from_index(document_id)

    # Remove chunks from SQLite
    db.query(Chunk).filter(Chunk.document_id == document_id).delete()

    # Remove document record
    db.delete(doc)
    db.commit()

    # Remove file from disk
    for ext in ALLOWED_EXTENSIONS:
        file_path = os.path.join(UPLOAD_DIR, f"{document_id}.{ext}")
        if os.path.exists(file_path):
            os.remove(file_path)

    return {"message": f"Document {document_id} deleted successfully"}