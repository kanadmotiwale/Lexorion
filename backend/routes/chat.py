from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from auth import get_user_id
from db.database import get_db, Document
from models.schemas import ChatRequest, ChatResponse, SourceChunk
from services.retriever import search_index
from services.rag_chain import run_rag_chain
from services.agent_eval import run_evaluation_pipeline

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    db:      Session = Depends(get_db),
    user_id: str     = Depends(get_user_id),
):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    # Step 1 — Vector search via pgvector, scoped to this user's documents
    chunks = search_index(
        query=request.question,
        db=db,
        top_k=request.top_k,
        score_threshold=request.score_threshold,
        user_id=user_id,
    )

    if not chunks:
        return ChatResponse(
            answer="I could not find relevant information in your documents. Please upload some documents first.",
            sources=[],
            confidence=0.0,
            model="llama-3.1-8b-instant",
        )

    # Step 2 — Build filename map (chunks already carry filename from pgvector query)
    filename_map = {c["document_id"]: c["filename"] for c in chunks}

    # Step 3 — Generate answer via Groq
    rag_result = run_rag_chain(
        question=request.question,
        chunks=chunks,
        filename_map=filename_map,
    )

    # Step 4 — Evaluate & re-rank
    eval_result = run_evaluation_pipeline(
        question=request.question,
        chunks=chunks,
        answer=rag_result["answer"],
    )

    final_chunks     = eval_result["reranked_chunks"]
    final_confidence = eval_result["adjusted_confidence"]

    sources = [
        SourceChunk(
            document_id = chunk["document_id"],
            filename    = chunk.get("filename", "unknown"),
            chunk_index = chunk["chunk_index"],
            text        = chunk["text"],
            score       = chunk.get("combined_score", chunk.get("score", 0.0)),
        )
        for chunk in final_chunks[:5]
    ]

    return ChatResponse(
        answer     = rag_result["answer"],
        sources    = sources,
        confidence = final_confidence,
        model      = rag_result["model"],
    )


@router.get("/chat/health")
def chat_health():
    return {"status": "ok", "service": "chat"}
