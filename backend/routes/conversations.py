import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from auth import get_user_id
from db.database import get_db, Conversation, Message
from models.schemas import ConversationOut, MessageOut

router = APIRouter()


# ── List all conversations for the current user ────────────────────────────────

@router.get("/conversations")
def list_conversations(
    db:      Session           = Depends(get_db),
    user_id: Optional[str]    = Depends(get_user_id),
):
    if not user_id:
        return {"conversations": []}

    convos = (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc())
        .all()
    )
    return {
        "conversations": [
            {
                "id":         c.id,
                "title":      c.title,
                "created_at": c.created_at.isoformat(),
                "updated_at": c.updated_at.isoformat(),
            }
            for c in convos
        ]
    }


# ── Get messages in a conversation ────────────────────────────────────────────

@router.get("/conversations/{conversation_id}/messages")
def get_messages(
    conversation_id: str,
    db:              Session        = Depends(get_db),
    user_id:         Optional[str] = Depends(get_user_id),
):
    if not user_id:
        raise HTTPException(status_code=401, detail="Sign in to view conversations")

    convo = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == user_id)
        .first()
    )
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msgs = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
        .all()
    )
    return {
        "messages": [
            {"role": m.role, "content": m.content, "sources": m.sources or []}
            for m in msgs
        ]
    }


# ── Delete a conversation ──────────────────────────────────────────────────────

@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    db:              Session        = Depends(get_db),
    user_id:         Optional[str] = Depends(get_user_id),
):
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    convo = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == user_id)
        .first()
    )
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Delete messages first to avoid orphaned rows
    db.query(Message).filter(Message.conversation_id == conversation_id).delete()
    db.delete(convo)
    db.commit()
    return {"message": "Deleted"}
