import os
from openai import OpenAI
from typing import List, Dict
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

LLM_MODEL = "gpt-4o-mini"
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

    prompt = f"""You are Lexorion, an intelligent knowledge assistant. 
You answer questions strictly based on the provided document context.
If the answer is not found in the context, say "I could not find relevant information in the indexed documents."
Always cite which source(s) you used in your answer.

CONTEXT:
{context}

QUESTION:
{question}

ANSWER:"""

    return prompt


# --- Confidence score ---

def calculate_confidence(chunks: List[Dict]) -> float:
    if not chunks:
        return 0.0

    scores = [chunk.get("score", 0.0) for chunk in chunks]
    avg_score = sum(scores) / len(scores)

    # Normalize to 0-1 range (FAISS cosine scores are already 0-1)
    confidence = round(min(max(avg_score, 0.0), 1.0), 2)
    return confidence


# --- Truncate context if too long ---

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

    # Attach filenames to chunks
    if filename_map:
        for chunk in chunks:
            chunk["filename"] = filename_map.get(chunk["document_id"], "unknown")

    # Truncate context to fit token limit
    chunks = truncate_chunks(chunks)

    # Build prompt
    prompt = build_prompt(question, chunks)

    # Call OpenAI
    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {
                "role": "system",
                "content": "You are Lexorion, a precise and helpful document knowledge assistant."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.2,
        max_tokens=1000,
    )

    answer = response.choices[0].message.content.strip()
    confidence = calculate_confidence(chunks)

    # Format sources
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