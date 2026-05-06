import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from auth import get_user_id
from db.database import get_db, Conversation, Message
from models.schemas import ChatRequest, ChatResponse, SourceChunk
from services.retriever import search_index
from services.rag_chain import run_rag_chain
from services.agent_eval import run_evaluation_pipeline

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    db:      Session           = Depends(get_db),
    user_id: Optional[str]    = Depends(get_user_id),
):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    # user_id is a real UUID, guest_<uuid>, or None
    effective_id = user_id or "anonymous"

    # Step 1 — Vector search scoped to this user's documents
    chunks = search_index(
        query=request.question,
        db=db,
        top_k=request.top_k,
        score_threshold=request.score_threshold,
        user_id=effective_id,
    )

    if not chunks:
        return ChatResponse(
            answer="I could not find relevant information in your documents. Please upload some documents first.",
            sources=[],
            confidence=0.0,
            model="llama-3.1-8b-instant",
            conversation_id=request.conversation_id,
        )

    filename_map = {c["document_id"]: c["filename"] for c in chunks}

    # Step 2 — Generate answer via Groq
    rag_result = run_rag_chain(
        question=request.question,
        chunks=chunks,
        filename_map=filename_map,
    )

    # Step 3 — Evaluate & re-rank
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

    answer           = rag_result["answer"]
    conversation_id  = request.conversation_id

    # Step 4 — Persist messages (only for signed-in users)
    if user_id:
        now = datetime.utcnow()

        # Create a new conversation on the first message
        if not conversation_id:
            title = request.question[:60] + ("…" if len(request.question) > 60 else "")
            convo = Conversation(
                id         = str(uuid.uuid4()),
                user_id    = user_id,
                title      = title,
                created_at = now,
                updated_at = now,
            )
            db.add(convo)
            db.flush()
            conversation_id = convo.id
        else:
            # Touch updated_at so the conversation bubbles to the top
            # Filter by user_id to prevent cross-user conversation injection
            convo = db.query(Conversation).filter(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id,
            ).first()
            if convo:
                convo.updated_at = now

        sources_json = [
            {
                "document_id": s.document_id,
                "filename":    s.filename,
                "chunk_index": s.chunk_index,
                "text":        s.text,
                "score":       s.score,
            }
            for s in sources
        ]

        db.add(Message(
            id              = str(uuid.uuid4()),
            conversation_id = conversation_id,
            role            = "user",
            content         = request.question,
            sources         = [],
            created_at      = now,
        ))
        db.add(Message(
            id              = str(uuid.uuid4()),
            conversation_id = conversation_id,
            role            = "assistant",
            content         = answer,
            sources         = sources_json,
            created_at      = now,
        ))
        db.commit()

    return ChatResponse(
        answer          = answer,
        sources         = sources,
        confidence      = final_confidence,
        model           = rag_result["model"],
        conversation_id = conversation_id,
    )


@router.get("/chat/health")
def chat_health():
    return {"status": "ok", "service": "chat"}
