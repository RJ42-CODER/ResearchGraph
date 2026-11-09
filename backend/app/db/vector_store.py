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

def index_paper_chunks(paper_id: str, chunks: list[str]):
    ids = [f"{paper_id}_chunk_{i}" for i in range(len(chunks))]
    metadata = [{
        "paper_id": paper_id,
        "chunk_index": i
    } for i in range(len(chunks))]
    collection.add(
        documents=chunks,
        ids=ids,
        metadatas=metadata
    )

def query_paper_chunks(paper_id: str, query: str = "", n_results: int = 4) -> list[str]:
    """Retrieve indexed chunks strictly for the specified paper_id.
    
    Never falls back to unconstrained collection queries, preventing
    contamination from unrelated papers when the requested paper has no chunks.
    """
    if not paper_id or not paper_id.strip():
        return []

    search_query = query.strip() if query and query.strip() else "architecture methodology parameters results"
    try:
        results = collection.query(
            query_texts=[search_query],
            n_results=n_results,
            where={"paper_id": paper_id.strip()}
        )
        if results and "documents" in results and results["documents"] and len(results["documents"][0]) > 0:
            return results["documents"][0]
    except Exception as e:
        print(f"ChromaDB Query Error for paper {paper_id}: {e}")
        
    return []
