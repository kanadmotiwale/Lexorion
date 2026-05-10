import uuid
from typing import List, Dict

CHUNK_SIZE      = 512
CHUNK_OVERLAP   = 64
EMBED_BATCH_SIZE = 16   # embed in small batches to avoid OOM and CPU spikes

# Guard against infinite loop — overlap must be smaller than chunk size
if CHUNK_OVERLAP >= CHUNK_SIZE:
    raise ValueError(
        f"CHUNK_OVERLAP ({CHUNK_OVERLAP}) must be less than CHUNK_SIZE ({CHUNK_SIZE})"
    )

# Lazy-load everything — nothing runs at import time
_encoding        = None
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
        from fastembed import TextEmbedding
        _embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
    return _embedding_model


# ── Text extraction ────────────────────────────────────────────────────────────

def parse_pdf_bytes(content: bytes) -> str:
    import fitz
    doc = fitz.open(stream=content, filetype="pdf")
    return "".join(page.get_text() for page in doc).strip()


def parse_text_bytes(content: bytes) -> str:
    return content.decode("utf-8", errors="ignore").strip()


def parse_file_bytes(content: bytes, file_type: str) -> str:
    if file_type == "pdf":
        return parse_pdf_bytes(content)
    elif file_type in ("txt", "md"):
        return parse_text_bytes(content)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


# ── Chunking ───────────────────────────────────────────────────────────────────

def tokenize(text: str) -> List[int]:
    return get_encoding().encode(text)


def decode_tokens(tokens: List[int]) -> str:
    return get_encoding().decode(tokens)


def chunk_text(text: str, document_id: str) -> List[Dict]:
    tokens      = tokenize(text)
    chunks      = []
    start       = 0
    chunk_index = 0

    while start < len(tokens):
        end          = start + CHUNK_SIZE
        chunk_tokens = tokens[start:end]
        chunk_str    = decode_tokens(chunk_tokens)

        chunks.append({
            "id":          str(uuid.uuid4()),
            "document_id": document_id,
            "chunk_index": chunk_index,
            "text":        chunk_str.strip(),
            "token_count": len(chunk_tokens),
        })

        chunk_index += 1
        start       += CHUNK_SIZE - CHUNK_OVERLAP

    return chunks


# ── Embeddings ─────────────────────────────────────────────────────────────────

def embed_texts(texts: List[str]) -> List[List[float]]:
    """Embed in small batches to avoid memory spikes and CPU timeouts on free tier."""
    model  = get_embedding_model()
    result = []
    for i in range(0, len(texts), EMBED_BATCH_SIZE):
        batch      = texts[i : i + EMBED_BATCH_SIZE]
        embeddings = list(model.embed(batch))
        result.extend(e.tolist() for e in embeddings)
    return result


def embed_query(query: str) -> List[float]:
    model      = get_embedding_model()
    embeddings = list(model.embed([query]))
    return embeddings[0].tolist()


# ── Full ETL pipeline (processes from raw bytes — no disk writes needed) ───────

def run_etl(content: bytes, file_type: str, document_id: str) -> List[Dict]:
    raw_text = parse_file_bytes(content, file_type)

    if not raw_text:
        raise ValueError("Could not extract text from the file")

    chunks     = chunk_text(raw_text, document_id)
    texts      = [c["text"] for c in chunks]
    embeddings = embed_texts(texts)

    for i, chunk in enumerate(chunks):
        chunk["embedding"] = embeddings[i]

    return chunks
