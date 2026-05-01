import os
from openai import OpenAI
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

EVAL_MODEL = "gpt-4o-mini"


# --- Pydantic models for structured evaluation ---

class ChunkRelevance(BaseModel):
    chunk_index: int
    relevance_score: float = Field(ge=0.0, le=1.0)
    reason: str


class EvaluationResult(BaseModel):
    is_answerable: bool
    overall_confidence: float = Field(ge=0.0, le=1.0)
    answer_quality: str  # "high" | "medium" | "low"
    chunk_relevances: List[ChunkRelevance]
    suggested_answer_focus: Optional[str] = None


# --- Evaluator agent ---

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

    # Build evaluation prompt
    chunks_text = ""
    for i, chunk in enumerate(chunks):
        chunks_text += (
            f"\nChunk {i} (score: {chunk.get('score', 0):.2f}):\n"
            f"{chunk['text'][:300]}...\n"
        )

    eval_prompt = f"""You are an evaluation agent for a RAG system called Lexorion.
Your job is to assess the quality of retrieved chunks and the generated answer.

QUESTION: {question}

RETRIEVED CHUNKS:
{chunks_text}

GENERATED ANSWER:
{answer}

Evaluate and respond in this exact JSON format:
{{
  "is_answerable": true or false,
  "overall_confidence": 0.0 to 1.0,
  "answer_quality": "high" or "medium" or "low",
  "chunk_relevances": [
    {{
      "chunk_index": 0,
      "relevance_score": 0.0 to 1.0,
      "reason": "brief reason"
    }}
  ],
  "suggested_answer_focus": "optional suggestion or null"
}}

Respond with JSON only. No extra text."""

    response = client.chat.completions.create(
        model=EVAL_MODEL,
        messages=[
            {
                "role": "system",
                "content": "You are a precise RAG evaluation agent. Respond only with valid JSON."
            },
            {
                "role": "user",
                "content": eval_prompt
            }
        ],
        temperature=0.0,
        max_tokens=800,
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    import json
    data = json.loads(raw)
    return EvaluationResult(**data)


# --- Re-ranker ---

def rerank_chunks(
    chunks: List[Dict],
    evaluation: EvaluationResult
) -> List[Dict]:
    if not evaluation.chunk_relevances:
        return chunks

    # Build a score map from evaluator
    relevance_map = {
        cr.chunk_index: cr.relevance_score
        for cr in evaluation.chunk_relevances
    }

    # Combine FAISS score with evaluator score
    for i, chunk in enumerate(chunks):
        faiss_score = chunk.get("score", 0.0)
        eval_score = relevance_map.get(i, 0.5)
        chunk["combined_score"] = (faiss_score * 0.5) + (eval_score * 0.5)

    # Sort by combined score descending
    reranked = sorted(chunks, key=lambda x: x["combined_score"], reverse=True)
    return reranked


# --- Full evaluation pipeline ---

def run_evaluation_pipeline(
    question: str,
    chunks: List[Dict],
    answer: str
) -> Dict:
    # Step 1: Evaluate
    evaluation = evaluate_retrieval(question, chunks, answer)

    # Step 2: Re-rank chunks
    reranked_chunks = rerank_chunks(chunks, evaluation)

    # Step 3: Adjust confidence based on evaluation
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