import chromadb
from chromadb.utils import embedding_functions

client = chromadb.PersistentClient(path="./data/chroma_db")
embedding_func = embedding_functions.OllamaEmbeddingFunction(
    url="http://localhost:11434/api/embeddings",
    model_name="nomic-embed-text",
)

collection = client.get_or_create_collection(
    name="research_papers",
    embedding_function=embedding_func
)


def chunk_text(text: str, chunk_size: int = 600, overlap: int = 200) -> list[str]:
    """Split text into overlapping character chunks for vector indexing."""
    cleaned = (text or "").strip()
    if not cleaned:
        return []

    step = max(1, chunk_size - overlap)
    chunks: list[str] = []
    start = 0
    while start < len(cleaned):
        end = start + chunk_size
        chunks.append(cleaned[start:end])
        if end >= len(cleaned):
            break
        start += step
    return chunks


def delete_paper_chunks(paper_id: str) -> None:
    """Remove all indexed chunks associated with a given paper/node ID."""
    clean_id = (paper_id or "").strip()
    if not clean_id:
        return
    try:
        collection.delete(where={"paper_id": clean_id})
    except Exception as e:
        print(f"ChromaDB Delete Error for {clean_id}: {e}")


def clear_vector_store(project_id: str = None) -> None:
    """Remove indexed documents from ChromaDB. If project_id is given, removes only that workspace's vectors."""
    try:
        if project_id and project_id.strip():
            collection.delete(where={"project_id": project_id.strip()})
        else:
            existing = collection.get(include=[])
            ids = existing.get("ids") if existing else None
            if ids:
                collection.delete(ids=ids)
    except Exception as e:
        print(f"ChromaDB Clear Error: {e}")


def index_paper_chunks(paper_id: str, chunks: list[str], project_id: str = "default") -> None:
    clean_id = (paper_id or "").strip()
    clean_pid = (project_id or "default").strip()
    valid_chunks = [c for c in chunks if c and c.strip()]
    if not clean_id or not valid_chunks:
        return

    delete_paper_chunks(clean_id)
    ids = [f"{clean_id}_chunk_{i}" for i in range(len(valid_chunks))]
    metadata = [
        {
            "paper_id": clean_id,
            "chunk_index": i,
            "project_id": clean_pid,
        }
        for i in range(len(valid_chunks))
    ]
    collection.upsert(
        documents=valid_chunks,
        ids=ids,
        metadatas=metadata,
    )


def index_paper_text(paper_id: str, text: str, project_id: str = "default") -> int:
    """Chunk and index raw text for a paper or workspace node. Returns chunk count."""
    chunks = chunk_text(text)
    if not chunks:
        return 0
    index_paper_chunks(paper_id=paper_id, chunks=chunks, project_id=project_id)
    return len(chunks)


def get_ordered_paper_chunks(paper_id: str) -> list[str]:
    """Retrieve all indexed chunks for paper_id sorted in original reading order."""
    clean_id = (paper_id or "").strip()
    if not clean_id:
        return []
    try:
        results = collection.get(
            where={"paper_id": clean_id},
            include=["documents", "metadatas"],
        )
        documents = results.get("documents") if results else None
        metadatas = results.get("metadatas") if results else None
        if not documents:
            return []
        paired = []
        for idx, doc in enumerate(documents):
            meta = metadatas[idx] if metadatas and idx < len(metadatas) else {}
            chunk_idx = meta.get("chunk_index", idx) if isinstance(meta, dict) else idx
            paired.append((chunk_idx, doc))
        paired.sort(key=lambda item: item[0])
        return [doc for _, doc in paired if doc]
    except Exception as e:
        print(f"ChromaDB Ordered Get Error for {clean_id}: {e}")
        return []


def query_paper_chunks(paper_id: str, query: str = "", n_results: int = 4) -> list[str]:
    """Retrieve indexed chunks strictly for the specified paper_id.

    Never falls back to unconstrained collection queries, preventing
    contamination from unrelated papers when the requested paper has no chunks.
    """
    if not paper_id or not paper_id.strip():
        return []

    search_query = (
        query.strip()
        if query and query.strip()
        else "architecture methodology parameters results"
    )
    try:
        results = collection.query(
            query_texts=[search_query],
            n_results=n_results,
            where={"paper_id": paper_id.strip()},
        )
        if (
            results
            and "documents" in results
            and results["documents"]
            and len(results["documents"][0]) > 0
        ):
            return results["documents"][0]
    except Exception as e:
        print(f"ChromaDB Query Error for paper {paper_id}: {e}")

    return []
