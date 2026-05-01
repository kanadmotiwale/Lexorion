import os
import uuid
import tiktoken
import fitz
from sentence_transformers import SentenceTransformer
from typing import List, Dict

EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
CHUNK_SIZE = 512
CHUNK_OVERLAP = 64

encoding = tiktoken.get_encoding("cl100k_base")
embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)


def count_tokens(text: str) -> int:
    return len(encoding.encode(text))

def tokenize(text: str) -> List[int]:
    return encoding.encode(text)

def decode_tokens(tokens: List[int]) -> str:
    return encoding.decode(tokens)


def parse_pdf(file_path: str) -> str:
    doc = fitz.open(file_path)
    text = ""
    for page in doc:
        text += page.get_text()
    return text.strip()

def parse_text(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read().strip()

def parse_file(file_path: str, file_type: str) -> str:
    if file_type == "pdf":
        return parse_pdf(file_path)
    elif file_type in ["txt", "md"]:
        return parse_text(file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


def chunk_text(text: str, document_id: str) -> List[Dict]:
    tokens = tokenize(text)
    chunks = []
    start = 0
    chunk_index = 0

    while start < len(tokens):
        end = start + CHUNK_SIZE
        chunk_tokens = tokens[start:end]
        chunk_text_decoded = decode_tokens(chunk_tokens)

        chunks.append({
            "id": str(uuid.uuid4()),
            "document_id": document_id,
            "chunk_index": chunk_index,
            "text": chunk_text_decoded.strip(),
            "token_count": len(chunk_tokens),
        })

        chunk_index += 1
        start += CHUNK_SIZE - CHUNK_OVERLAP

    return chunks


def embed_texts(texts: List[str]) -> List[List[float]]:
    embeddings = embedding_model.encode(texts, show_progress_bar=False)
    return embeddings.tolist()

def embed_query(query: str) -> List[float]:
    embedding = embedding_model.encode([query], show_progress_bar=False)
    return embedding[0].tolist()


def run_etl(file_path: str, file_type: str, document_id: str) -> List[Dict]:
    raw_text = parse_file(file_path, file_type)

    if not raw_text:
        raise ValueError("Could not extract text from file")

    chunks = chunk_text(raw_text, document_id)
    texts = [chunk["text"] for chunk in chunks]
    embeddings = embed_texts(texts)

    for i, chunk in enumerate(chunks):
        chunk["embedding"] = embeddings[i]

    return chunks