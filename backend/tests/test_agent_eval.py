import json

from services import agent_eval
from services.agent_eval import EvaluationResult, ChunkRelevance

GOOD_JSON = {
    "is_answerable": True,
    "overall_confidence": 0.8,
    "answer_quality": "high",
    "chunk_relevances": [
        {"chunk_index": 0, "relevance_score": 0.2, "reason": "off topic"},
        {"chunk_index": 1, "relevance_score": 0.95, "reason": "direct answer"},
    ],
    "suggested_answer_focus": None,
}


def test_evaluate_with_no_chunks_is_unanswerable():
    result = agent_eval.evaluate_retrieval("q", [], "a")
    assert result.is_answerable is False
    assert result.overall_confidence == 0.0


def test_evaluate_parses_plain_json(monkeypatch, fake_groq, sample_chunks):
    monkeypatch.setattr(agent_eval, "client", fake_groq(json.dumps(GOOD_JSON)))
    result = agent_eval.evaluate_retrieval("q", sample_chunks[:2], "a")
    assert result.answer_quality == "high"
    assert result.chunk_relevances[1].relevance_score == 0.95


def test_evaluate_parses_markdown_fenced_json_with_chatter(monkeypatch, fake_groq, sample_chunks):
    raw = "Sure!\n```json\n" + json.dumps(GOOD_JSON) + "\n```\nHope that helps."
    monkeypatch.setattr(agent_eval, "client", fake_groq(raw))
    result = agent_eval.evaluate_retrieval("q", sample_chunks[:2], "a")
    assert result.overall_confidence == 0.8


def test_evaluate_malformed_json_returns_safe_fallback(monkeypatch, fake_groq, sample_chunks):
    monkeypatch.setattr(agent_eval, "client", fake_groq("this is not json at all"))
    result = agent_eval.evaluate_retrieval("q", sample_chunks, "a")
    assert result.is_answerable is True
    assert result.overall_confidence == 0.5
    assert result.chunk_relevances == []


def test_evaluate_out_of_range_scores_fall_back(monkeypatch, fake_groq, sample_chunks):
    bad = dict(GOOD_JSON, overall_confidence=7)   # violates ge/le validation
    monkeypatch.setattr(agent_eval, "client", fake_groq(json.dumps(bad)))
    assert agent_eval.evaluate_retrieval("q", sample_chunks, "a").overall_confidence == 0.5


def test_rerank_orders_by_combined_score(sample_chunks):
    evaluation = EvaluationResult(
        is_answerable=True, overall_confidence=0.8, answer_quality="high",
        chunk_relevances=[
            ChunkRelevance(chunk_index=0, relevance_score=0.0, reason=""),
            ChunkRelevance(chunk_index=1, relevance_score=1.0, reason=""),
        ],
    )
    ranked = agent_eval.rerank_chunks(sample_chunks[:2], evaluation)
    # chunk 1: 0.6*0.5 + 1.0*0.5 = 0.8 beats chunk 0: 0.9*0.5 + 0.0*0.5 = 0.45
    assert [c["chunk_index"] for c in ranked] == [1, 0]
    assert ranked[0]["combined_score"] == 0.8


def test_rerank_without_relevances_keeps_order(sample_chunks):
    evaluation = EvaluationResult(
        is_answerable=True, overall_confidence=0.5, answer_quality="medium", chunk_relevances=[],
    )
    assert agent_eval.rerank_chunks(sample_chunks, evaluation) == sample_chunks


def test_pipeline_survives_llm_failure(monkeypatch, fake_groq, sample_chunks):
    monkeypatch.setattr(agent_eval, "client", fake_groq(raises=RuntimeError("groq down")))
    out = agent_eval.run_evaluation_pipeline("q", sample_chunks, "a")
    assert out["reranked_chunks"] == sample_chunks
    assert out["answer_quality"] == "medium"
    # 0.5 * 0.6 + top score 0.9 * 0.4
    assert out["adjusted_confidence"] == 0.66


def test_pipeline_blends_eval_confidence_with_top_score(monkeypatch, fake_groq, sample_chunks):
    monkeypatch.setattr(agent_eval, "client", fake_groq(json.dumps(GOOD_JSON)))
    out = agent_eval.run_evaluation_pipeline("q", sample_chunks[:2], "a")
    assert out["reranked_chunks"][0]["chunk_index"] == 1
    assert out["is_answerable"] is True
    assert 0.0 <= out["adjusted_confidence"] <= 1.0
