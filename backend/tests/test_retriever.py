from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from services import retriever


def _row(**overrides):
    base = dict(
        id="c1", document_id="d1", chunk_index=0, text="hello", token_count=3,
        filename="a.txt", file_type="txt", score=0.81,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


@pytest.fixture(autouse=True)
def fake_embedding(monkeypatch):
    monkeypatch.setattr(retriever, "embed_query", lambda q: [0.1, 0.2, 0.3])


def _db_returning(rows):
    db = MagicMock()
    db.execute.return_value.fetchall.return_value = rows
    return db


def test_no_user_id_returns_nothing_and_never_queries():
    db = MagicMock()
    assert retriever.search_index("q", db, user_id=None) == []
    db.execute.assert_not_called()


def test_hybrid_is_default_and_maps_rows():
    db = _db_returning([_row()])

    results = retriever.search_index("refund policy", db, user_id="u1")

    assert results == [{
        "id": "c1", "document_id": "d1", "chunk_index": 0, "text": "hello",
        "token_count": 3, "filename": "a.txt", "file_type": "txt", "score": 0.81,
    }]
    sql, params = db.execute.call_args.args
    assert "fused" in str(sql)                     # the RRF query, not the vector-only one
    assert params["user_id"] == "u1"               # always scoped to the caller
    assert params["query"] == "refund policy"


def test_vector_mode_skips_full_text():
    db = _db_returning([_row()])
    retriever.search_index("q", db, user_id="u1", mode="vector")
    sql, _ = db.execute.call_args.args
    assert "fused" not in str(sql)


def test_filters_are_pushed_into_sql():
    db = _db_returning([])
    retriever.search_index("q", db, user_id="u1", document_ids=["d1"], file_type="pdf")
    sql, params = db.execute.call_args.args
    assert params["doc_ids"] == ["d1"]
    assert params["file_type"] == "pdf"
    assert "d.file_type = :file_type" in str(sql)


def test_candidate_pool_scales_with_top_k():
    db = _db_returning([])
    retriever.search_index("q", db, top_k=3, user_id="u1")
    assert db.execute.call_args.args[1]["pool"] == retriever.MIN_CANDIDATES
    retriever.search_index("q", db, top_k=50, user_id="u1")
    assert db.execute.call_args.args[1]["pool"] == 50 * retriever.CANDIDATE_FACTOR


def test_hybrid_failure_rolls_back_and_falls_back_to_vector():
    db = MagicMock()
    ok = MagicMock()
    ok.fetchall.return_value = [_row(id="fallback")]
    db.execute.side_effect = [RuntimeError("column tsv does not exist"), ok]

    results = retriever.search_index("q", db, user_id="u1")

    db.rollback.assert_called_once()
    assert [r["id"] for r in results] == ["fallback"]
    assert db.execute.call_count == 2
