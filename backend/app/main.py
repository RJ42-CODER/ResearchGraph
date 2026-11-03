from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from app.api.papers import router as papers_router
from app.sandbox.runner import execute_sandboxed_code
from app.agents.pipeline import research_graph_pipeline
from app.db.database import init_db, save_node, save_edge, load_graph
from app.db.vector_store import query_paper_chunks

import sqlite3
import shutil
import os
from app.db.database import DB_PATH

# Initialize the database
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

@app.get("/api/workspace/graph")
async def get_workspace_graph():
    return load_graph()

@app.post("/api/workspace/node")
async def persist_node(req: NodeSaveRequest):
    save_node(req.id, req.type, req.position.get("x", 0), req.position.get("y", 0), req.data)
    return {"status": "saved"}

@app.post("/api/workspace/edge")
async def persist_edge(req: EdgeSaveRequest):
    save_edge(req.id, req.source, req.target, req.label)
    return {"status": "saved"}

@app.post("/api/agents/run-pipeline")
async def trigger_agent_pipeline(req: RunWorkflowRequest):
    # Retrieve context from ChromaDB if paper_id provided
    retrieved_text = ""
    if req.paper_id:
        retrieved_text = query_paper_chunks(req.paper_id)
    
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