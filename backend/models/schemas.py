from pydantic import BaseModel
from typing import Optional, List
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