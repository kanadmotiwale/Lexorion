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
) -> List[Dict]:
    """Search chunks using pgvector cosine similarity."""
    query_embedding = embed_query(query)
    embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

    if document_ids:
        sql = text("""
            SELECT
                c.id, c.document_id, c.chunk_index, c.text, c.token_count,
                d.filename,
                1 - (c.embedding <=> CAST(:embedding AS vector)) AS score
            FROM chunks c
            JOIN documents d ON c.document_id = d.id
            WHERE c.document_id = ANY(:doc_ids)
              AND 1 - (c.embedding <=> CAST(:embedding AS vector)) >= :threshold
            ORDER BY c.embedding <=> CAST(:embedding AS vector)
            LIMIT :top_k
        """)
        rows = db.execute(sql, {
            "embedding":  embedding_str,
            "doc_ids":    document_ids,
            "threshold":  score_threshold,
            "top_k":      top_k,
        }).fetchall()
    else:
        sql = text("""
            SELECT
                c.id, c.document_id, c.chunk_index, c.text, c.token_count,
                d.filename,
                1 - (c.embedding <=> CAST(:embedding AS vector)) AS score
            FROM chunks c
            JOIN documents d ON c.document_id = d.id
            WHERE 1 - (c.embedding <=> CAST(:embedding AS vector)) >= :threshold
            ORDER BY c.embedding <=> CAST(:embedding AS vector)
            LIMIT :top_k
        """)
        rows = db.execute(sql, {
            "embedding": embedding_str,
            "threshold": score_threshold,
            "top_k":     top_k,
        }).fetchall()

    return [
        {
            "id":           row.id,
            "document_id":  row.document_id,
            "chunk_index":  row.chunk_index,
            "text":         row.text,
            "token_count":  row.token_count,
            "filename":     row.filename,
            "score":        float(row.score),
        }
        for row in rows
    ]


def get_index_stats(db: Session) -> Dict:
    """Return basic stats about indexed content."""
    row = db.execute(text("""
        SELECT
            COUNT(*)                    AS total_chunks,
            COUNT(DISTINCT document_id) AS unique_documents
        FROM chunks
    """)).fetchone()
    return {
        "total_chunks":      row.total_chunks,
        "unique_documents":  row.unique_documents,
    }
