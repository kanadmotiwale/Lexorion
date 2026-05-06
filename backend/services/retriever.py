from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from services.etl import embed_query


def search_index(
    query: str,
    db: Session,
    top_k: int = 5,
    score_threshold: float = 0.0,
    document_ids: Optional[List[str]] = None,
    user_id: Optional[str] = None,
) -> List[Dict]:
    """Search chunks using pgvector cosine similarity, scoped to a user."""
    query_embedding = embed_query(query)
    embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

    # Always scope to a user — never leak data across users
    # If user_id is None we return nothing rather than exposing everyone's data
    if user_id is None:
        return []

    # Build WHERE clauses
    filters = ["1 - (c.embedding <=> CAST(:embedding AS vector)) >= :threshold"]
    params: Dict = {"embedding": embedding_str, "threshold": score_threshold, "top_k": top_k}

    filters.append("d.user_id = :user_id")
    params["user_id"] = user_id

    if document_ids:
        filters.append("c.document_id = ANY(:doc_ids)")
        params["doc_ids"] = document_ids

    where_clause = " AND ".join(filters)

    sql = text(f"""
        SELECT
            c.id, c.document_id, c.chunk_index, c.text, c.token_count,
            d.filename, d.file_type,
            1 - (c.embedding <=> CAST(:embedding AS vector)) AS score
        FROM chunks c
        JOIN documents d ON c.document_id = d.id
        WHERE {where_clause}
        ORDER BY c.embedding <=> CAST(:embedding AS vector)
        LIMIT :top_k
    """)

    rows = db.execute(sql, params).fetchall()

    return [
        {
            "id":           row.id,
            "document_id":  row.document_id,
            "chunk_index":  row.chunk_index,
            "text":         row.text,
            "token_count":  row.token_count,
            "filename":     row.filename,
            "file_type":    row.file_type,
            "score":        float(row.score),
        }
        for row in rows
    ]


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
