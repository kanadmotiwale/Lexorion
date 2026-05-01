from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from db.database import get_db, Document
from models.schemas import ChatRequest, ChatResponse, SourceChunk
from services.retriever import search_index
from services.rag_chain import run_rag_chain
from services.agent_eval import run_evaluation_pipeline

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest, db: Session = Depends(get_db)):
    if not request.question.strip():
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty"
        )

    # Step 1: Retrieve relevant chunks from FAISS
    chunks = search_index(
        query=request.question,
        top_k=request.top_k,
        score_threshold=request.score_threshold,
    )

    if not chunks:
        return ChatResponse(
            answer="I could not find relevant information in the indexed documents. Please upload some documents first.",
            sources=[],
            confidence=0.0,
            model="gpt-4o-mini",
        )

    # Step 2: Build filename map from DB
    document_ids = list(set(chunk["document_id"] for chunk in chunks))
    documents = db.query(Document).filter(
        Document.id.in_(document_ids)
    ).all()
    filename_map = {doc.id: doc.filename for doc in documents}

    # Attach filenames to chunks
    for chunk in chunks:
        chunk["filename"] = filename_map.get(chunk["document_id"], "unknown")

    # Step 3: Run RAG chain to generate answer
    rag_result = run_rag_chain(
        question=request.question,
        chunks=chunks,
        filename_map=filename_map,
    )

    # Step 4: Run agent evaluation + re-ranking
    eval_result = run_evaluation_pipeline(
        question=request.question,
        chunks=chunks,
        answer=rag_result["answer"],
    )

    # Step 5: Use re-ranked chunks and adjusted confidence
    final_chunks = eval_result["reranked_chunks"]
    final_confidence = eval_result["adjusted_confidence"]

    # Step 6: Format sources
    sources = [
        SourceChunk(
            document_id=chunk["document_id"],
            filename=chunk.get("filename", "unknown"),
            chunk_index=chunk["chunk_index"],
            text=chunk["text"],
            score=chunk.get("combined_score", chunk.get("score", 0.0)),
        )
        for chunk in final_chunks[:5]
    ]

    return ChatResponse(
        answer=rag_result["answer"],
        sources=sources,
        confidence=final_confidence,
        model=rag_result["model"],
    )


# --- Health check for chat service ---

@router.get("/chat/health")
def chat_health():
    return {"status": "ok", "service": "chat"}