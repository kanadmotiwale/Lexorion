from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from db.database import get_db, Document
from models.schemas import SearchResponse, SearchResult
from services.retriever import search_index, get_index_stats

router = APIRouter()


# ── Semantic search ────────────────────────────────────────────────────────────

@router.get("/search", response_model=SearchResponse)
def semantic_search(
    query:           str            = Query(..., min_length=1),
    top_k:           int            = Query(5, ge=1, le=20),
    score_threshold: float          = Query(0.0, ge=0.0, le=1.0),
    file_type:       Optional[str]  = Query(None),
    db:              Session        = Depends(get_db),
):
    chunks = search_index(
        query=query,
        db=db,
        top_k=top_k,
        score_threshold=score_threshold,
    )

    if not chunks:
        return SearchResponse(query=query, results=[], total=0)

    results = []
    for chunk in chunks:
        # Filter by file_type if requested
        if file_type:
            doc = db.query(Document).filter(Document.id == chunk["document_id"]).first()
            if not doc or doc.file_type != file_type:
                continue

        results.append(SearchResult(
            document_id = chunk["document_id"],
            filename    = chunk["filename"],
            chunk_index = chunk["chunk_index"],
            text        = chunk["text"],
            score       = round(chunk["score"], 4),
            token_count = chunk.get("token_count", 0),
        ))

    return SearchResponse(query=query, results=results, total=len(results))


# ── Stats ──────────────────────────────────────────────────────────────────────

@router.get("/search/stats")
def index_stats(db: Session = Depends(get_db)):
    return {"status": "ok", "index": get_index_stats(db)}


# ── Search within a document ───────────────────────────────────────────────────

@router.get("/search/document/{document_id}", response_model=SearchResponse)
def search_in_document(
    document_id: str,
    query:       str     = Query(..., min_length=1),
    top_k:       int     = Query(5, ge=1, le=20),
    db:          Session = Depends(get_db),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    chunks = search_index(
        query=query,
        db=db,
        top_k=top_k,
        score_threshold=0.0,
        document_ids=[document_id],
    )

    results = [
        SearchResult(
            document_id = chunk["document_id"],
            filename    = doc.filename,
            chunk_index = chunk["chunk_index"],
            text        = chunk["text"],
            score       = round(chunk["score"], 4),
            token_count = chunk.get("token_count", 0),
        )
        for chunk in chunks
    ]

    return SearchResponse(query=query, results=results, total=len(results))
