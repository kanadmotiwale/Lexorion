import os
import uuid
import tiktoken
import fitz  # PyMuPDF
import requests
from typing import List, Dict

OLLAMA_BASE_URL = "http://localhost:11434"
EMBEDDING_MODEL = "nomic-embed-text"
CHUNK_SIZE = 512
CHUNK_OVERLAP = 64
encoding = tiktoken.get_encoding("cl100k_base")


# --- Tokenize ---

def count_tokens(text: str) -> int:
    return len(encoding.encode(text))

def tokenize(text: str) -> List[int]:
    return encoding.encode(text)

def decode_tokens(tokens: List[int]) -> str:
    return encoding.decode(tokens)


# --- Parse ---

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


# --- Chunk ---

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


# --- Embed ---

def embed_single(text: str) -> List[float]:
    response = requests.post(
        f"{OLLAMA_BASE_URL}/api/embeddings",
        json={"model": EMBEDDING_MODEL, "prompt": text}
    )
    response.raise_for_status()
    return response.json()["embedding"]

def embed_texts(texts: List[str]) -> List[List[float]]:
    embeddings = []
    for text in texts:
        embedding = embed_single(text)
        embeddings.append(embedding)
    return embeddings

def embed_query(query: str) -> List[float]:
    return embed_single(query)


# --- Full ETL pipeline ---

def run_etl(file_path: str, file_type: str, document_id: str) -> List[Dict]:
    # 1. Parse
    raw_text = parse_file(file_path, file_type)

    if not raw_text:
        raise ValueError("Could not extract text from file")

    # 2. Chunk
    chunks = chunk_text(raw_text, document_id)

    # 3. Embed
    texts = [chunk["text"] for chunk in chunks]
    embeddings = embed_texts(texts)

    # 4. Attach embeddings
    for i, chunk in enumerate(chunks):
        chunk["embedding"] = embeddings[i]

    return chunks