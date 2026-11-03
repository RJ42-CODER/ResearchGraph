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

def index_paper_chunks(paper_id:str, chunks: list[str]):
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

def query_paper_chunks(paper_id: str, query: str = "", n_results: int = 4):
    """Retrieve chunks for paper_id with robust fallback."""
    search_query = query if query and query.strip() else "architecture methodology parameters results"
    try:
        # First attempt: search with exact metadata filter
        results = collection.query(
            query_texts=[search_query],
            n_results=n_results,
            where={"paper_id": paper_id}
        )
        if results and "documents" in results and results["documents"] and len(results["documents"][0]) > 0:
            return results["documents"][0]
        
        # Second attempt: fallback without where filter so text is never dropped
        fallback = collection.query(query_texts=[search_query], n_results=n_results)
        if fallback and "documents" in fallback and fallback["documents"]:
            return fallback["documents"][0]
    except Exception as e:
        print(f"ChromaDB Query Error: {e}")
    return []