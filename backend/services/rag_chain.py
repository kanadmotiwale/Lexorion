import requests
from typing import List, Dict

OLLAMA_BASE_URL = "http://localhost:11434"
LLM_MODEL = "llama3.2"
MAX_CONTEXT_TOKENS = 3000


# --- Prompt builder ---

def build_prompt(question: str, chunks: List[Dict]) -> str:
    context_parts = []

    for i, chunk in enumerate(chunks):
        context_parts.append(
            f"[Source {i+1}] File: {chunk.get('filename', 'unknown')} | "
            f"Chunk {chunk['chunk_index']}\n{chunk['text']}"
        )

    context = "\n\n---\n\n".join(context_parts)

    return f"""You are Lexorion, an intelligent knowledge assistant.
Answer questions strictly based on the provided document context.
If the answer is not found in the context, say "I could not find relevant information in the indexed documents."
Always cite which source(s) you used.

CONTEXT:
{context}

QUESTION:
{question}

ANSWER:"""


# --- Confidence score ---

def calculate_confidence(chunks: List[Dict]) -> float:
    if not chunks:
        return 0.0
    scores = [chunk.get("score", 0.0) for chunk in chunks]
    avg_score = sum(scores) / len(scores)
    return round(min(max(avg_score, 0.0), 1.0), 2)


# --- Truncate context ---

def truncate_chunks(chunks: List[Dict], max_tokens: int = MAX_CONTEXT_TOKENS) -> List[Dict]:
    total_tokens = 0
    truncated = []
    for chunk in chunks:
        chunk_tokens = chunk.get("token_count", len(chunk["text"].split()) * 2)
        if total_tokens + chunk_tokens > max_tokens:
            break
        truncated.append(chunk)
        total_tokens += chunk_tokens
    return truncated


# --- Main RAG function ---

def run_rag_chain(
    question: str,
    chunks: List[Dict],
    filename_map: Dict[str, str] = None
) -> Dict:
    if not chunks:
        return {
            "answer": "I could not find relevant information in the indexed documents.",
            "sources": [],
            "confidence": 0.0,
            "model": LLM_MODEL,
        }

    if filename_map:
        for chunk in chunks:
            chunk["filename"] = filename_map.get(chunk["document_id"], "unknown")

    chunks = truncate_chunks(chunks)
    prompt = build_prompt(question, chunks)

    # Call Ollama
    response = requests.post(
        f"{OLLAMA_BASE_URL}/api/generate",
        json={
            "model": LLM_MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.2,
                "num_predict": 1000,
            }
        }
    )
    response.raise_for_status()
    answer = response.json()["response"].strip()
    confidence = calculate_confidence(chunks)

    sources = []
    for chunk in chunks:
        sources.append({
            "document_id": chunk["document_id"],
            "filename": chunk.get("filename", "unknown"),
            "chunk_index": chunk["chunk_index"],
            "text": chunk["text"],
            "score": chunk.get("score", 0.0),
        })

    return {
        "answer": answer,
        "sources": sources,
        "confidence": confidence,
        "model": LLM_MODEL,
    }