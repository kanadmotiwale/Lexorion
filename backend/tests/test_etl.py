from types import SimpleNamespace

import pytest

from services import etl


# ── Chunking ───────────────────────────────────────────────────────────────────

def test_chunk_text_sizes_and_overlap():
    text   = " ".join(f"word{i}" for i in range(1500))
    chunks = etl.chunk_text(text, "doc1")

    assert len(chunks) >= 2
    assert all(c["token_count"] <= etl.CHUNK_SIZE for c in chunks)
    assert [c["chunk_index"] for c in chunks] == list(range(len(chunks)))
    assert all(c["document_id"] == "doc1" for c in chunks)
    assert len({c["id"] for c in chunks}) == len(chunks)

    # Consecutive chunks overlap: the end of one chunk reappears at the start of the next
    assert chunks[0]["text"][-30:] in chunks[1]["text"]


def test_chunk_text_short_input_is_one_chunk():
    chunks = etl.chunk_text("A short note.", "doc1")
    assert len(chunks) == 1
    assert chunks[0]["text"] == "A short note."


def test_chunk_text_empty_input():
    assert etl.chunk_text("", "doc1") == []


# ── Parsing ────────────────────────────────────────────────────────────────────

def test_parse_text_bytes_strips_and_ignores_bad_bytes():
    assert etl.parse_text_bytes(b"  hello \xff world  ") == "hello  world"


def test_parse_file_bytes_dispatch_and_unsupported():
    assert etl.parse_file_bytes(b"notes", "txt") == "notes"
    assert etl.parse_file_bytes(b"# title", "md") == "# title"
    with pytest.raises(ValueError):
        etl.parse_file_bytes(b"x", "exe")


def test_run_etl_rejects_empty_documents():
    with pytest.raises(ValueError, match="Could not extract text"):
        etl.run_etl(b"   ", "txt", "doc1")


def test_run_etl_attaches_embeddings(monkeypatch):
    monkeypatch.setattr(etl, "embed_texts", lambda texts: [[0.1, 0.2]] * len(texts))
    chunks = etl.run_etl(b"hello world", "txt", "doc1")
    assert chunks[0]["embedding"] == [0.1, 0.2]


# ── Embedding backends ─────────────────────────────────────────────────────────

def test_embed_texts_uses_local_model_without_hf_token(monkeypatch):
    monkeypatch.setattr(etl, "HF_TOKEN", "")
    monkeypatch.setattr(etl, "_embed_via_local", lambda texts: [[1.0]] * len(texts))
    monkeypatch.setattr(etl, "_embed_via_hf_api", lambda texts: pytest.fail("HF API should not be used"))
    assert etl.embed_texts(["a", "b"]) == [[1.0], [1.0]]


def test_embed_texts_uses_hf_api_with_token(monkeypatch):
    monkeypatch.setattr(etl, "HF_TOKEN", "hf_x")
    monkeypatch.setattr(etl, "_embed_via_hf_api", lambda texts: [[2.0]] * len(texts))
    assert etl.embed_texts(["a"]) == [[2.0]]


def test_hf_api_batches_and_mean_pools_token_embeddings(monkeypatch):
    monkeypatch.setattr(etl, "HF_TOKEN", "hf_x")
    monkeypatch.setattr(etl, "EMBED_BATCH_SIZE", 2)
    calls = []

    def fake_post(url, headers, json, timeout):
        calls.append(len(json["inputs"]))
        # token-level output: [seq_len=2][dim=2] per input
        return SimpleNamespace(status_code=200, json=lambda: [[[1.0, 2.0], [3.0, 4.0]]] * len(json["inputs"]))

    monkeypatch.setattr(etl.requests, "post", fake_post)

    result = etl._embed_via_hf_api(["a", "b", "c"])

    assert calls == [2, 1]                       # batched 2 + 1
    assert result == [[2.0, 3.0]] * 3            # mean over tokens


def test_hf_api_retries_while_model_loads(monkeypatch):
    monkeypatch.setattr(etl, "HF_TOKEN", "hf_x")
    monkeypatch.setattr(etl.time, "sleep", lambda _s: None)
    responses = [
        SimpleNamespace(status_code=503, text="loading", json=lambda: None),
        SimpleNamespace(status_code=200, text="", json=lambda: [[0.5, 0.5]]),
    ]
    monkeypatch.setattr(etl.requests, "post", lambda *a, **k: responses.pop(0))

    assert etl._embed_via_hf_api(["a"]) == [[0.5, 0.5]]


def test_hf_api_raises_on_error_status(monkeypatch):
    monkeypatch.setattr(etl, "HF_TOKEN", "hf_x")
    monkeypatch.setattr(
        etl.requests, "post",
        lambda *a, **k: SimpleNamespace(status_code=401, text="unauthorized", json=lambda: None),
    )
    with pytest.raises(RuntimeError, match="401"):
        etl._embed_via_hf_api(["a"])
