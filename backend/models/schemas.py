from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


# --- Upload ---

class DocumentResponse(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size: int
    total_chunks: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- Chat ---

class ChatRequest(BaseModel):
    question: str
    top_k: Optional[int] = 5
    score_threshold: Optional[float] = 0.75
    conversation_id: Optional[str] = None   # pass to continue an existing conversation


class SourceChunk(BaseModel):
    document_id: str
    filename: str
    chunk_index: int
    text: str
    score: float


class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceChunk]
    confidence: float
    model: str
    conversation_id: Optional[str] = None   # returned so the frontend can track it


# --- Search ---

class SearchRequest(BaseModel):
    query: str
    top_k: Optional[int] = 5
    score_threshold: Optional[float] = 0.0
    file_type: Optional[str] = None


class SearchResult(BaseModel):
    document_id: str
    filename: str
    chunk_index: int
    text: str
    score: float
    token_count: int


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    total: int


# --- Document list ---

class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]
    total: int


# --- Conversations ---

class ConversationOut(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MessageOut(BaseModel):
    role: str
    content: str
    sources: Optional[List[Any]] = []

    class Config:
        from_attributes = True
