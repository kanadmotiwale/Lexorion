import os
import uuid
from typing import List, Dict

CHUNK_SIZE = 512
CHUNK_OVERLAP = 64

# Lazy load — both tiktoken and embedding model load on first request, not at startup
_encoding = None
_embedding_model = None


def get_encoding():
    global _encoding
    if _encoding is None:
        import tiktoken
        _encoding = tiktoken.get_encoding("cl100k_base")
    return _encoding

def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer
        _embedding_model = SentenceTransformer("BAAI/bge-small-en-v1.5")
    return _embedding_model


def tokenize(text: str) -> List[int]:
    return get_encoding().encode(text)

def decode_tokens(tokens: List[int]) -> str:
    return get_encoding().decode(tokens)


def parse_pdf(file_path: str) -> str:
    import fitz
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
    model = get_embedding_model()
    embeddings = model.encode(texts, normalize_embeddings=False)
    return [e.tolist() for e in embeddings]

def embed_query(query: str) -> List[float]:
    model = get_embedding_model()
    embeddings = model.encode([query], normalize_embeddings=False)
    return embeddings[0].tolist()


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