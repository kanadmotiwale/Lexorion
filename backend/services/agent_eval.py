import json
import requests
from pydantic import BaseModel, Field
from typing import List, Dict, Optional

OLLAMA_BASE_URL = "http://localhost:11434"
EVAL_MODEL = "llama3.2"


# --- Pydantic models ---

class ChunkRelevance(BaseModel):
    chunk_index: int
    relevance_score: float = Field(ge=0.0, le=1.0)
    reason: str

class EvaluationResult(BaseModel):
    is_answerable: bool
    overall_confidence: float = Field(ge=0.0, le=1.0)
    answer_quality: str
    chunk_relevances: List[ChunkRelevance]
    suggested_answer_focus: Optional[str] = None


# --- Evaluator ---

def evaluate_retrieval(
    question: str,
    chunks: List[Dict],
    answer: str
) -> EvaluationResult:
    if not chunks:
        return EvaluationResult(
            is_answerable=False,
            overall_confidence=0.0,
            answer_quality="low",
            chunk_relevances=[],
            suggested_answer_focus=None,
        )

    chunks_text = ""
    for i, chunk in enumerate(chunks):
        chunks_text += (
            f"\nChunk {i} (score: {chunk.get('score', 0):.2f}):\n"
            f"{chunk['text'][:300]}...\n"
        )

    eval_prompt = f"""You are an evaluation agent for a RAG system called Lexorion.
Assess the quality of retrieved chunks and the generated answer.

QUESTION: {question}

RETRIEVED CHUNKS:
{chunks_text}

GENERATED ANSWER:
{answer}

Respond in this exact JSON format only, no extra text:
{{
  "is_answerable": true,
  "overall_confidence": 0.85,
  "answer_quality": "high",
  "chunk_relevances": [
    {{
      "chunk_index": 0,
      "relevance_score": 0.9,
      "reason": "directly answers the question"
    }}
  ],
  "suggested_answer_focus": null
}}"""

    response = requests.post(
        f"{OLLAMA_BASE_URL}/api/generate",
        json={
            "model": EVAL_MODEL,
            "prompt": eval_prompt,
            "stream": False,
            "options": {"temperature": 0.0, "num_predict": 600}
        }
    )
    response.raise_for_status()
    raw = response.json()["response"].strip()

    # Strip markdown fences if present
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    # Extract JSON object
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start != -1 and end > start:
        raw = raw[start:end]

    data = json.loads(raw)
    return EvaluationResult(**data)


# --- Re-ranker ---

def rerank_chunks(chunks: List[Dict], evaluation: EvaluationResult) -> List[Dict]:
    if not evaluation.chunk_relevances:
        return chunks

    relevance_map = {
        cr.chunk_index: cr.relevance_score
        for cr in evaluation.chunk_relevances
    }

    for i, chunk in enumerate(chunks):
        faiss_score = chunk.get("score", 0.0)
        eval_score = relevance_map.get(i, 0.5)
        chunk["combined_score"] = (faiss_score * 0.5) + (eval_score * 0.5)

    return sorted(chunks, key=lambda x: x["combined_score"], reverse=True)


# --- Full pipeline ---

def run_evaluation_pipeline(
    question: str,
    chunks: List[Dict],
    answer: str
) -> Dict:
    evaluation = evaluate_retrieval(question, chunks, answer)
    reranked_chunks = rerank_chunks(chunks, evaluation)

    adjusted_confidence = round(
        (evaluation.overall_confidence * 0.6) +
        (reranked_chunks[0].get("score", 0.0) * 0.4)
        if reranked_chunks else 0.0,
        2
    )

    return {
        "reranked_chunks": reranked_chunks,
        "evaluation": evaluation,
        "adjusted_confidence": adjusted_confidence,
        "answer_quality": evaluation.answer_quality,
        "is_answerable": evaluation.is_answerable,
    }