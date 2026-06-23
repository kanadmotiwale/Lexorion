import os
import uuid
import time
import requests
from typing import List, Dict

CHUNK_SIZE       = 512
CHUNK_OVERLAP    = 64
EMBED_BATCH_SIZE = 32

# Guard against infinite loop
if CHUNK_OVERLAP >= CHUNK_SIZE:
    raise ValueError(
        f"CHUNK_OVERLAP ({CHUNK_OVERLAP}) must be less than CHUNK_SIZE ({CHUNK_SIZE})"
    )

HF_TOKEN   = os.getenv("HF_TOKEN", "")
HF_MODEL   = "sentence-transformers/all-MiniLM-L6-v2"   # 384-dim, free, fast
HF_API_URL = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{HF_MODEL}"

# Lazy-load local model only when HF API is not configured
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
        # Must match the HF API model (HF_MODEL) so both embedding paths produce
        # vectors in the same space — mixing them silently breaks similarity search.
        _embedding_model = TextEmbedding(model_name=HF_MODEL)
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


# ── Embeddings via HuggingFace Inference API ───────────────────────────────────

def _embed_via_hf_api(texts: List[str]) -> List[List[float]]:
    """Call HuggingFace Inference API in batches. Free, no local model needed."""
    headers = {"Authorization": f"Bearer {HF_TOKEN}"}
    result  = []

    for i in range(0, len(texts), EMBED_BATCH_SIZE):
        batch   = texts[i : i + EMBED_BATCH_SIZE]
        payload = {"inputs": batch, "options": {"wait_for_model": True}}

        for attempt in range(3):
            resp = requests.post(HF_API_URL, headers=headers, json=payload, timeout=60)
            if resp.status_code == 200:
                embeddings = resp.json()
                # HF returns shape [n, seq_len, dim] for feature-extraction — mean-pool
                for emb in embeddings:
                    if isinstance(emb[0], list):
                        # token-level: mean pool across tokens
                        vec = [sum(tok[d] for tok in emb) / len(emb) for d in range(len(emb[0]))]
                    else:
                        vec = emb
                    result.append(vec)
                break
            elif resp.status_code == 503:
                # Model loading — wait and retry
                time.sleep(10)
            else:
                raise RuntimeError(f"HF API error {resp.status_code}: {resp.text[:200]}")
        else:
            raise RuntimeError("HF API unavailable after 3 retries")

    return result


# ── Embeddings via local fastembed (fallback) ──────────────────────────────────

def _embed_via_local(texts: List[str]) -> List[List[float]]:
    """Local ONNX model — works but uses ~250MB RAM, slow on free tier."""
    model  = get_embedding_model()
    result = []
    for i in range(0, len(texts), EMBED_BATCH_SIZE):
        batch      = texts[i : i + EMBED_BATCH_SIZE]
        embeddings = list(model.embed(batch))
        result.extend(e.tolist() for e in embeddings)
    return result


def embed_texts(texts: List[str]) -> List[List[float]]:
    if HF_TOKEN:
        return _embed_via_hf_api(texts)
    return _embed_via_local(texts)


def embed_query(query: str) -> List[float]:
    return embed_texts([query])[0]


# ── Full ETL pipeline ──────────────────────────────────────────────────────────

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
