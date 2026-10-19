from services import rag_chain


def test_calculate_confidence_is_clamped_mean(sample_chunks):
    assert rag_chain.calculate_confidence(sample_chunks) == 0.6
    assert rag_chain.calculate_confidence([]) == 0.0
    assert rag_chain.calculate_confidence([{"score": 5.0}]) == 1.0
    assert rag_chain.calculate_confidence([{"score": -2.0}]) == 0.0


def test_truncate_chunks_respects_token_budget():
    chunks = [{"text": "a", "token_count": 2000}, {"text": "b", "token_count": 2000}]
    assert rag_chain.truncate_chunks(chunks, max_tokens=3000) == chunks[:1]
    assert rag_chain.truncate_chunks(chunks, max_tokens=5000) == chunks


def test_truncate_chunks_estimates_missing_token_counts():
    chunk = {"text": "word " * 100}   # no token_count → ~2 tokens per word
    assert rag_chain.truncate_chunks([chunk], max_tokens=150) == []
    assert rag_chain.truncate_chunks([chunk], max_tokens=250) == [chunk]


def test_build_prompt_contains_sources_and_question(sample_chunks):
    prompt = rag_chain.build_prompt("What is the refund window?", sample_chunks[:2])
    assert "[Source 1] File: policy.pdf | Chunk 0" in prompt
    assert "[Source 2]" in prompt
    assert "Refunds are issued within 30 days." in prompt
    assert "What is the refund window?" in prompt


def test_run_rag_chain_with_no_chunks_skips_llm(monkeypatch):
    monkeypatch.setattr(rag_chain, "client", None)   # would crash if touched
    result = rag_chain.run_rag_chain("anything", [])
    assert result["sources"] == []
    assert result["confidence"] == 0.0
    assert "could not find" in result["answer"].lower()


def test_run_rag_chain_returns_answer_sources_and_confidence(monkeypatch, fake_groq, sample_chunks):
    monkeypatch.setattr(rag_chain, "client", fake_groq("  Refunds take 30 days [Source 1].  "))

    result = rag_chain.run_rag_chain(
        "Refund window?", sample_chunks[:2], filename_map={"d1": "policy.pdf"},
    )

    assert result["answer"] == "Refunds take 30 days [Source 1]."
    assert [s["chunk_index"] for s in result["sources"]] == [0, 1]
    assert result["sources"][0]["filename"] == "policy.pdf"
    assert result["confidence"] == 0.75
    assert result["model"] == rag_chain.LLM_MODEL
