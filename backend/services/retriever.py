import logging
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from services.etl import embed_query

logger = logging.getLogger("lexorion.retriever")

RRF_K            = 60   # standard Reciprocal Rank Fusion constant
CANDIDATE_FACTOR = 4    # each retriever fetches top_k * factor candidates before fusion
MIN_CANDIDATES   = 20

SEARCH_MODES = ("hybrid", "vector")


def _scope_filters(
    user_id: str,
    document_ids: Optional[List[str]],
    file_type: Optional[str],
    params: Dict,
) -> str:
    """WHERE fragments shared by both retrievers. Always scoped to a user."""
    filters = ["d.user_id = :user_id"]
    params["user_id"] = user_id

    if document_ids:
        filters.append("c.document_id = ANY(:doc_ids)")
        params["doc_ids"] = document_ids
    if file_type:
        filters.append("d.file_type = :file_type")
        params["file_type"] = file_type

    return " AND ".join(filters)


def _row_to_dict(row) -> Dict:
    return {
        "id":          row.id,
        "document_id": row.document_id,
        "chunk_index": row.chunk_index,
        "text":        row.text,
        "token_count": row.token_count,
        "filename":    row.filename,
        "file_type":   row.file_type,
        "score":       float(row.score),   # cosine similarity, 0–1 — used for thresholds/confidence
    }


def _vector_search(
    db: Session, embedding_str: str, top_k: int, score_threshold: float,
    user_id: str, document_ids, file_type,
) -> List[Dict]:
    params: Dict = {"embedding": embedding_str, "threshold": score_threshold, "top_k": top_k}
    scope = _scope_filters(user_id, document_ids, file_type, params)

    sql = text(f"""
        SELECT
            c.id, c.document_id, c.chunk_index, c.text, c.token_count,
            d.filename, d.file_type,
            1 - (c.embedding <=> CAST(:embedding AS vector)) AS score
        FROM chunks c
        JOIN documents d ON c.document_id = d.id
        WHERE {scope}
          AND 1 - (c.embedding <=> CAST(:embedding AS vector)) >= :threshold
        ORDER BY c.embedding <=> CAST(:embedding AS vector)
        LIMIT :top_k
    """)
    return [_row_to_dict(r) for r in db.execute(sql, params).fetchall()]


def _hybrid_search(
    db: Session, query: str, embedding_str: str, top_k: int, score_threshold: float,
    user_id: str, document_ids, file_type,
) -> List[Dict]:
    """
    Hybrid retrieval: pgvector cosine ranking + Postgres full-text ranking, merged with
    Reciprocal Rank Fusion (score = Σ 1 / (k + rank)). Semantic search finds paraphrases;
    keyword search finds exact names, IDs and rare terms that embeddings blur together.
    """
    pool = max(top_k * CANDIDATE_FACTOR, MIN_CANDIDATES)
    params: Dict = {
        "embedding": embedding_str,
        "threshold": score_threshold,
        "top_k":     top_k,
        "pool":      pool,
        "rrf_k":     RRF_K,
        "query":     query,
    }
    scope = _scope_filters(user_id, document_ids, file_type, params)

    # The question is turned into an OR-query of its stemmed, stopword-free terms so a
    # natural-language question matches chunks containing *any* key term (ranked by overlap)
    # instead of requiring every word to appear.
    sql = text(f"""
        WITH q AS (
            SELECT to_tsquery(
                'english',
                array_to_string(tsvector_to_array(to_tsvector('english', :query)), ' | ')
            ) AS tsq
        ),
        vec AS (
            SELECT c.id,
                   ROW_NUMBER() OVER (ORDER BY c.embedding <=> CAST(:embedding AS vector)) AS rnk
            FROM chunks c
            JOIN documents d ON c.document_id = d.id
            WHERE {scope}
            ORDER BY c.embedding <=> CAST(:embedding AS vector)
            LIMIT :pool
        ),
        kw AS (
            SELECT c.id,
                   ROW_NUMBER() OVER (ORDER BY ts_rank_cd(c.tsv, q.tsq) DESC) AS rnk
            FROM chunks c
            JOIN documents d ON c.document_id = d.id
            CROSS JOIN q
            WHERE {scope} AND c.tsv @@ q.tsq
            ORDER BY ts_rank_cd(c.tsv, q.tsq) DESC
            LIMIT :pool
        ),
        fused AS (
            SELECT COALESCE(vec.id, kw.id) AS id,
                   COALESCE(1.0 / (:rrf_k + vec.rnk), 0)
                 + COALESCE(1.0 / (:rrf_k + kw.rnk),  0) AS rrf
            FROM vec FULL OUTER JOIN kw ON vec.id = kw.id
        )
        SELECT
            c.id, c.document_id, c.chunk_index, c.text, c.token_count,
            d.filename, d.file_type,
            1 - (c.embedding <=> CAST(:embedding AS vector)) AS score
        FROM fused f
        JOIN chunks c    ON c.id = f.id
        JOIN documents d ON c.document_id = d.id
        WHERE 1 - (c.embedding <=> CAST(:embedding AS vector)) >= :threshold
        ORDER BY f.rrf DESC, score DESC
        LIMIT :top_k
    """)
    return [_row_to_dict(r) for r in db.execute(sql, params).fetchall()]


def search_index(
    query: str,
    db: Session,
    top_k: int = 5,
    score_threshold: float = 0.0,
    document_ids: Optional[List[str]] = None,
    user_id: Optional[str] = None,
    file_type: Optional[str] = None,
    mode: str = "hybrid",
) -> List[Dict]:
    """Search a user's chunks. mode='hybrid' (default) fuses vector + keyword ranking;
    mode='vector' is pure cosine similarity. Results are ordered best-first."""
    # Always scope to a user — never leak data across users.
    # If user_id is None we return nothing rather than exposing everyone's data.
    if user_id is None:
        return []

    query_embedding = embed_query(query)
    embedding_str   = "[" + ",".join(str(x) for x in query_embedding) + "]"

    if mode == "hybrid":
        try:
            return _hybrid_search(
                db, query, embedding_str, top_k, score_threshold,
                user_id, document_ids, file_type,
            )
        except Exception:
            # e.g. full-text column not created yet, or an unparseable tsquery.
            # Reset the aborted transaction and degrade to pure vector search.
            logger.exception("Hybrid search failed — falling back to vector search")
            db.rollback()

    return _vector_search(
        db, embedding_str, top_k, score_threshold, user_id, document_ids, file_type,
    )


def get_index_stats(db: Session, user_id: Optional[str] = None) -> Dict:
    """Return basic stats about indexed content, optionally scoped to a user."""
    if user_id:
        row = db.execute(text("""
            SELECT
                COUNT(c.id)                    AS total_chunks,
                COUNT(DISTINCT c.document_id)  AS unique_documents
            FROM chunks c
            JOIN documents d ON c.document_id = d.id
            WHERE d.user_id = :user_id
        """), {"user_id": user_id}).fetchone()
    else:
        row = db.execute(text("""
            SELECT
                COUNT(*)                    AS total_chunks,
                COUNT(DISTINCT document_id) AS unique_documents
            FROM chunks
        """)).fetchone()

    return {
        "total_chunks":     row.total_chunks,
        "unique_documents": row.unique_documents,
    }
