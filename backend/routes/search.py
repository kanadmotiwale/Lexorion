from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from db.database import get_db, Document, Chunk
from models.schemas import SearchResponse, SearchResult
from services.retriever import search_index, get_index_stats

router = APIRouter()


# --- Semantic search ---

@router.get("/search", response_model=SearchResponse)
def semantic_search(
    query: str = Query(..., min_length=1, description="Search query"),
    top_k: int = Query(5, ge=1, le=20),
    score_threshold: float = Query(0.0, ge=0.0, le=1.0),
    file_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    if not query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    # Search FAISS index
    chunks = search_index(
        query=query,
        top_k=top_k,
        score_threshold=score_threshold,
    )

    if not chunks:
        return SearchResponse(
            query=query,
            results=[],
            total=0,
        )

    # Build document map for filenames
    document_ids = list(set(chunk["document_id"] for chunk in chunks))
    documents = db.query(Document).filter(
        Document.id.in_(document_ids)
    ).all()
    doc_map = {doc.id: doc for doc in documents}

    # Filter by file_type if provided
    results = []
    for chunk in chunks:
        doc = doc_map.get(chunk["document_id"])
        if not doc:
            continue

        if file_type and doc.file_type != file_type:
            continue

        results.append(
            SearchResult(
                document_id=chunk["document_id"],
                filename=doc.filename,
                chunk_index=chunk["chunk_index"],
                text=chunk["text"],
                score=round(chunk["score"], 4),
                token_count=chunk.get("token_count", 0),
            )
        )

    return SearchResponse(
        query=query,
        results=results,
        total=len(results),
    )


# --- Index stats ---

@router.get("/search/stats")
def index_stats():
    stats = get_index_stats()
    return {
        "status": "ok",
        "index": stats,
    }


# --- Search within a specific document ---

@router.get("/search/document/{document_id}", response_model=SearchResponse)
def search_in_document(
    document_id: str,
    query: str = Query(..., min_length=1),
    top_k: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
):
    # Verify document exists
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Search only within this document
    chunks = search_index(
        query=query,
        top_k=top_k,
        score_threshold=0.0,
        document_ids=[document_id],
    )

    results = [
        SearchResult(
            document_id=chunk["document_id"],
            filename=doc.filename,
            chunk_index=chunk["chunk_index"],
            text=chunk["text"],
            score=round(chunk["score"], 4),
            token_count=chunk.get("token_count", 0),
        )
        for chunk in chunks
    ]

    return SearchResponse(
        query=query,
        results=results,
        total=len(results),
    )