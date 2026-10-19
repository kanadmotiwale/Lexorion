"""HTTP-level tests. The database dependency is replaced with a mock and the LLM / vector
search calls are patched, so no external service is touched."""
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

import main
from auth import get_user_id
from db.database import get_db


@pytest.fixture
def client():
    db = MagicMock()
    main.app.dependency_overrides[get_db] = lambda: db
    main.app.dependency_overrides[get_user_id] = lambda: "guest_test"
    # No `with` block: startup (init_db → real Postgres) must not run in tests.
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


def test_root_and_health(client):
    assert client.get("/").json()["name"] == "Lexorion"
    assert client.get("/health").json()["status"] == "healthy"


def test_debug_endpoint_is_gone(client):
    assert client.get("/api/v1/debug/whoami").status_code == 404


# ── Upload ─────────────────────────────────────────────────────────────────────

def test_upload_rejects_unsupported_extension(client):
    resp = client.post("/api/v1/upload", files={"file": ("malware.exe", b"data")})
    assert resp.status_code == 400
    assert "not supported" in resp.json()["detail"]


def test_upload_rejects_oversized_file(client):
    big = b"x" * (10 * 1024 * 1024 + 1)
    resp = client.post("/api/v1/upload", files={"file": ("big.txt", big)})
    assert resp.status_code == 400
    assert "too large" in resp.json()["detail"].lower()


# ── Chat ───────────────────────────────────────────────────────────────────────

def test_chat_rejects_blank_question(client):
    assert client.post("/api/v1/chat", json={"question": "   "}).status_code == 400


def test_chat_rejects_unknown_mode(client):
    resp = client.post("/api/v1/chat", json={"question": "hi", "mode": "telepathy"})
    assert resp.status_code == 422


def test_chat_with_no_documents_returns_helpful_answer(client, monkeypatch):
    monkeypatch.setattr("routes.chat.search_index", lambda **kw: [])
    body = client.post("/api/v1/chat", json={"question": "anything?"}).json()
    assert body["sources"] == []
    assert body["confidence"] == 0.0


def test_chat_full_pipeline(client, monkeypatch, sample_chunks):
    seen = {}

    def fake_search(**kwargs):
        seen.update(kwargs)
        return sample_chunks[:2]

    monkeypatch.setattr("routes.chat.search_index", fake_search)
    monkeypatch.setattr(
        "routes.chat.run_rag_chain",
        lambda **kw: {"answer": "30 days [Source 1]", "sources": [], "confidence": 0.7, "model": "m"},
    )
    monkeypatch.setattr(
        "routes.chat.run_evaluation_pipeline",
        lambda **kw: {"reranked_chunks": list(reversed(kw["chunks"])), "adjusted_confidence": 0.82},
    )

    resp = client.post("/api/v1/chat", json={"question": "Refund window?", "mode": "vector"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["answer"] == "30 days [Source 1]"
    assert body["confidence"] == 0.82
    assert [s["chunk_index"] for s in body["sources"]] == [1, 0]   # re-ranked order preserved
    assert body["conversation_id"]                                  # a conversation was created
    assert seen["user_id"] == "guest_test"                          # scoped to caller
    assert seen["mode"] == "vector"                                 # mode is passed through


# ── Search ─────────────────────────────────────────────────────────────────────

def test_search_returns_results(client, monkeypatch, sample_chunks):
    seen = {}

    def fake_search(**kwargs):
        seen.update(kwargs)
        return sample_chunks[:2]

    monkeypatch.setattr("routes.search.search_index", fake_search)

    body = client.get("/api/v1/search", params={"query": "refund", "file_type": "pdf"}).json()

    assert body["total"] == 2
    assert body["results"][0]["filename"] == "policy.pdf"
    assert seen["file_type"] == "pdf"          # filter is applied in SQL, not after LIMIT
    assert seen["mode"] == "hybrid"


def test_search_validates_parameters(client):
    assert client.get("/api/v1/search", params={"query": "x", "mode": "bogus"}).status_code == 422
    assert client.get("/api/v1/search", params={"query": "x", "top_k": 0}).status_code == 422
    assert client.get("/api/v1/search").status_code == 422


# ── Conversations ──────────────────────────────────────────────────────────────

def test_conversations_require_signed_in_user(client):
    main.app.dependency_overrides[get_user_id] = lambda: None
    assert client.get("/api/v1/conversations").json() == {"conversations": []}
    assert client.get("/api/v1/conversations/abc/messages").status_code == 401
    assert client.delete("/api/v1/conversations/abc").status_code == 401
