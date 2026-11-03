import os
import sqlite3
import shutil
from typing import Optional, List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ollama

from app.api.papers import router as papers_router
from app.sandbox.runner import execute_sandboxed_code
from app.agents.pipeline import research_graph_pipeline
from app.db.database import init_db, save_node, save_edge, load_graph, DB_PATH
from app.db.vector_store import query_paper_chunks

# Initialize database tables on startup
init_db()

app = FastAPI(title="ResearchGraph API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(papers_router)

# Request Models
class ChatRequest(BaseModel):
    paper_id: str
    query: str

class CrossReferenceRequest(BaseModel):
    paper_ids: List[str]

class RunWorkflowRequest(BaseModel):
    paper_id: Optional[str] = None
    paper_text: Optional[str] = None

class ExecuteCodeRequest(BaseModel):
    code: str

class NodeSaveRequest(BaseModel):
    id: str
    type: str = "default"
    position: dict
    data: dict

class EdgeSaveRequest(BaseModel):
    id: str
    source: str
    target: str
    label: str


# --- Graph & Workspace State Endpoints ---

@app.get("/api/workspace/graph")
async def get_workspace_graph():
    return load_graph()

@app.post("/api/workspace/node")
async def persist_node(req: NodeSaveRequest):
    save_node(req.id, req.type, req.position.get("x", 0), req.position.get("y", 0), req.data)
    return {"status": "saved"}

@app.delete("/api/workspace/node/{node_id}")
async def delete_node_endpoint(node_id: str):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM graph_nodes WHERE id = ?", (node_id,))
        cursor.execute("DELETE FROM graph_edges WHERE source = ? OR target = ?", (node_id, node_id))
        conn.commit()
        conn.close()
        return {"status": "deleted", "node_id": node_id}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/workspace/edge")
async def persist_edge(req: EdgeSaveRequest):
    save_edge(req.id, req.source, req.target, req.label)
    return {"status": "saved"}

@app.delete("/api/workspace/reset")
async def reset_workspace():
    # 1. Clear SQLite tables
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM graph_nodes")
        cursor.execute("DELETE FROM graph_edges")
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Database reset error: {e}")

    # 2. Reset uploaded files cache
    upload_dir = "./data/uploads"
    if os.path.exists(upload_dir):
        for filename in os.listdir(upload_dir):
            file_path = os.path.join(upload_dir, filename)
            try:
                if os.path.isfile(file_path):
                    os.unlink(file_path)
            except Exception:
                pass

    return {"status": "success", "message": "Workspace reset completely"}


# --- Multi-Agent Orchestration & Chat ---

@app.post("/api/agents/chat")
async def chat_with_paper(req: ChatRequest):
    relevant_chunks = query_paper_chunks(paper_id=req.paper_id, query=req.query, n_results=4)
    context_text = "\n\n".join(relevant_chunks) if relevant_chunks else "No specific paper text found."

    prompt = f"""You are a scientific research assistant. Answer the user's question clearly in plain English, citing participant numbers, conditions, and findings where available.

Context from the paper:
{context_text}

User Question: {req.query}
"""
    response = ollama.chat(
        model="llama3.2:3b",
        messages=[{"role": "user", "content": prompt}],
    )
    return {"reply": response["message"]["content"]}

@app.post("/api/agents/cross-reference")
async def cross_reference_papers(req: CrossReferenceRequest):
    combined_contexts = []
    for pid in req.paper_ids:
        chunks = query_paper_chunks(
            paper_id=pid, 
            query="sample size methodology results effect size hyperparameters", 
            n_results=3
        )
        combined_contexts.append(f"--- Paper ID: {pid} ---\n" + "\n".join(chunks))

    prompt = f"""You are a scientific literature reviewer. Compare the connected studies below.
Highlight:
1. Sample size (N) or model dimensions
2. Experimental methodology / conditions
3. Key findings and whether they agree, contradict, or extend each other

Present the result as an easy-to-read structured summary for a student.

Paper Data:
{chr(10).join(combined_contexts)}
"""
    response = ollama.chat(
        model="llama3.2:3b",
        messages=[{"role": "user", "content": prompt}],
    )
    return {"comparison_summary": response["message"]["content"]}

@app.post("/api/agents/run-pipeline")
async def trigger_agent_pipeline(req: RunWorkflowRequest):
    retrieved_text = ""
    if req.paper_id:
        chunks = query_paper_chunks(
            paper_id=req.paper_id, 
            query="model architecture hyperparameters layers dimensions attention heads methodology", 
            n_results=4
        )
        retrieved_text = "\n\n".join(chunks) if chunks else ""
    
    context_text = retrieved_text if retrieved_text else (req.paper_text or "")

    result = research_graph_pipeline.invoke({"paper_text": context_text})
    
    return {
        "status": "pending_approval",
        "hyperparameters": result.get("hyperparameters"),
        "generated_code": result.get("generated_code"),
        "eval_status": result.get("eval_status")
    }

@app.post("/api/sandbox/execute")
async def execute_experiment(req: ExecuteCodeRequest):
    return execute_sandboxed_code(req.code)