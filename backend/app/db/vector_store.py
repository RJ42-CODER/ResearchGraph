import chromadb
from chromadb.utils import embedding_functions

chroma_client = chromadb.PersistentClient(path="./data/chroma_db")

# Ollama embedding function
ollama_ef = embedding_functions.OllamaEmbeddingFunction(
    url="http://localhost:11434/api/embeddings",
    model_name="nomic-embed-text"
)

collection = chroma_client.get_or_create_collection(
    name="Research_Papers",
    embedding_function=ollama_ef
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

def query_paper_chunks(paper_id: str, query: str = "hyperparameters d_model heads layers architecture", n_results: int = 3):
    results = collection.query(
        query_texts=[query],
        where={"paper_id": paper_id},
        n_results=n_results,
    )
    if results and results.get("documents") and len(results["documents"]) > 0:
        return "\n\n".join(results["documents"][0])
    return ""
