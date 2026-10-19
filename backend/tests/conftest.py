"""Test environment.

These variables are assigned (not setdefault) BEFORE any app module is imported, so a
developer's real backend/.env — which the app loads with python-dotenv — can never point
the tests at a real database, LLM or auth secret.
"""
import os

os.environ["GROQ_API_KEY"]         = "test-groq-key"
os.environ["HF_TOKEN"]             = ""
os.environ["DB_HOST"]              = "localhost"
os.environ["DB_PASS"]              = "test"
os.environ["SUPABASE_JWT_SECRET"]  = "test-jwt-secret-test-jwt-secret-1234"
os.environ["SUPABASE_URL"]         = ""

from types import SimpleNamespace  # noqa: E402

import pytest  # noqa: E402


@pytest.fixture
def fake_groq():
    """Build a stand-in for a Groq client whose completion returns `content`."""
    def _make(content: str = "", raises: Exception | None = None):
        def create(**_kwargs):
            if raises:
                raise raises
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content=content))]
            )
        return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    return _make


@pytest.fixture
def sample_chunks():
    return [
        {"id": "c1", "document_id": "d1", "chunk_index": 0, "text": "Refunds are issued within 30 days.",
         "token_count": 10, "filename": "policy.pdf", "file_type": "pdf", "score": 0.9},
        {"id": "c2", "document_id": "d1", "chunk_index": 1, "text": "Shipping takes 5 business days.",
         "token_count": 10, "filename": "policy.pdf", "file_type": "pdf", "score": 0.6},
        {"id": "c3", "document_id": "d2", "chunk_index": 0, "text": "Our office is in Boston.",
         "token_count": 10, "filename": "about.md", "file_type": "md", "score": 0.3},
    ]
