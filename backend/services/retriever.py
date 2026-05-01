import os
import uuid
import faiss
import numpy as np
import pickle
from typing import List, Dict, Tuple
from services.etl import embed_query

FAISS_INDEX_PATH = "faiss_index/index.faiss"
METADATA_PATH = "faiss_index/metadata.pkl"
EMBEDDING_DIM = 1536  # text-embedding-3-small dimension


# --- Init ---

def ensure_index_dir():
    os.makedirs("faiss_index", exist_ok=True)


def create_index() -> faiss.IndexFlatIP:
    index = faiss.IndexFlatIP(EMBEDDING_DIM)
    return index


def load_index() -> Tuple[faiss.IndexFlatIP, List[Dict]]:
    ensure_index_dir()

    if os.path.exists(FAISS_INDEX_PATH) and os.path.exists(METADATA_PATH):
        index = faiss.read_index(FAISS_INDEX_PATH)
        with open(METADATA_PATH, "rb") as f:
            metadata = pickle.load(f)
    else:
        index = create_index()
        metadata = []

    return index, metadata


def save_index(index: faiss.IndexFlatIP, metadata: List[Dict]):
    ensure_index_dir()
    faiss.write_index(index, FAISS_INDEX_PATH)
    with open(METADATA_PATH, "wb") as f:
        pickle.dump(metadata, f)


# --- Add chunks to index ---

def add_chunks_to_index(chunks: List[Dict]):
    index, metadata = load_index()

    embeddings = [chunk["embedding"] for chunk in chunks]
    vectors = np.array(embeddings, dtype=np.float32)

    # Normalize for cosine similarity
    faiss.normalize_L2(vectors)

    index.add(vectors)

    # Store metadata (everything except the embedding)
    for chunk in chunks:
        metadata.append({
            "id": chunk["id"],
            "document_id": chunk["document_id"],
            "chunk_index": chunk["chunk_index"],
            "text": chunk["text"],
            "token_count": chunk["token_count"],
        })

    save_index(index, metadata)


# --- Search ---

def search_index(
    query: str,
    top_k: int = 5,
    score_threshold: float = 0.0,
    document_ids: List[str] = None
) -> List[Dict]:
    index, metadata = load_index()

    if index.ntotal == 0:
        return []

    # Embed and normalize query
    query_embedding = embed_query(query)
    query_vector = np.array([query_embedding], dtype=np.float32)
    faiss.normalize_L2(query_vector)

    # Search
    scores, indices = index.search(query_vector, min(top_k * 2, index.ntotal))

    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx == -1:
            continue
        if score < score_threshold:
            continue

        chunk_meta = metadata[idx]

        # Optional: filter by document_id
        if document_ids and chunk_meta["document_id"] not in document_ids:
            continue

        results.append({
            **chunk_meta,
            "score": float(score),
        })

        if len(results) >= top_k:
            break

    return results


# --- Delete chunks by document_id ---

def delete_document_from_index(document_id: str):
    index, metadata = load_index()

    # Filter out chunks belonging to this document
    keep_indices = [
        i for i, m in enumerate(metadata)
        if m["document_id"] != document_id
    ]

    if len(keep_indices) == len(metadata):
        return  # Nothing to delete

    kept_metadata = [metadata[i] for i in keep_indices]

    # Rebuild index with remaining vectors
    new_index = create_index()

    if keep_indices:
        vectors = np.zeros((len(keep_indices), EMBEDDING_DIM), dtype=np.float32)
        for new_i, old_i in enumerate(keep_indices):
            vectors[new_i] = index.reconstruct(old_i)
        faiss.normalize_L2(vectors)
        new_index.add(vectors)

    save_index(new_index, kept_metadata)


# --- Stats ---

def get_index_stats() -> Dict:
    index, metadata = load_index()
    return {
        "total_vectors": index.ntotal,
        "total_chunks": len(metadata),
        "unique_documents": len(set(m["document_id"] for m in metadata)),
    }