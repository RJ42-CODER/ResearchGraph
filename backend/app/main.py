import os
import re
import sqlite3
import shutil
from typing import Optional, List, Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ollama

from app.api.papers import router as papers_router
from app.api.discovery import router as discovery_router
from app.sandbox.runner import execute_sandboxed_code
from app.agents.pipeline import research_graph_pipeline
from app.db.database import (
    init_db,
    save_node,
    save_edge,
    load_graph,
    get_node_data,
    DB_PATH,
)
from app.db.vector_store import (
    chunk_text,
    clear_vector_store,
    delete_paper_chunks,
    get_ordered_paper_chunks,
    index_paper_text,
    query_paper_chunks,
)

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
app.include_router(discovery_router)

# Request Models
class ChatRequest(BaseModel):
    paper_id: str
    query: str
    fallback_context: Optional[str] = None
    source_paper_ids: Optional[List[str]] = None

class CrossReferenceRequest(BaseModel):
    paper_ids: List[str]
    paper_contexts: Optional[Dict[str, str]] = None

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


def _build_node_index_text(node_id: str, node_type: str, data: dict) -> str:
    """Build searchable text from workspace node metadata for ChromaDB indexing."""
    if not isinstance(data, dict):
        return ""

    effective_type = (node_type or data.get("_node_type") or "").strip()
    is_uploaded_pdf = effective_type == "uploadedPaper" or node_id.startswith("paper")
    if is_uploaded_pdf and not data.get("abstract"):
        # Uploaded PDFs are indexed directly from full PDF text by /api/papers/upload.
        return ""

    is_note = effective_type == "note" or node_id.startswith("note") or data.get("type") == "note"
    if is_note:
        title = str(data.get("title") or "").strip()
        label = str(data.get("label") or "").strip()
        note_body = title if title and title != "Note" else label
        return note_body

    is_result = effective_type == "result" or node_id.startswith("result")
    if is_result:
        title = str(data.get("title") or "Synthesis Results").strip()
        summary = str(data.get("summary") or "").strip()
        if not summary:
            return ""
        return f"Title: {title}\n\n{summary}"

    parts: List[str] = []
    title = str(data.get("title") or "").strip()
    if title:
        parts.append(f"Title: {title}")

    authors = data.get("authors")
    if isinstance(authors, list) and authors:
        parts.append("Authors: " + ", ".join(str(a) for a in authors if a))

    if data.get("year"):
        parts.append(f"Year: {data['year']}")

    if data.get("publication"):
        parts.append(f"Publication: {data['publication']}")

    if data.get("doi"):
        parts.append(f"DOI: {data['doi']}")

    abstract = str(data.get("abstract") or "").strip()
    summary = str(data.get("summary") or "").strip()
    if abstract:
        parts.append(f"Abstract:\n{abstract}")
    elif summary and summary != "Verified academic metadata from Discovery Hub.":
        parts.append(f"Summary:\n{summary}")

    return "\n".join(parts).strip()


def _try_index_node(node_id: str, node_type: str, data: dict) -> None:
    """Best-effort index of non-PDF workspace nodes into ChromaDB."""
    target_id = str(data.get("paper_id") or node_id).strip()
    text = _build_node_index_text(node_id, node_type, data)
    if not target_id or not text:
        return
    try:
        index_paper_text(paper_id=target_id, text=text)
    except Exception as e:
        print(f"ChromaDB node index warning for {target_id}: {e}")


def _clean_markdown(text: str) -> str:
    """Strip Markdown syntax tokens (**, *, #, backticks) into clean plain text."""
    if not text:
        return ""
    cleaned = re.sub(r"```[a-zA-Z0-9_-]*\n?", "", text)
    cleaned = re.sub(r"^\s*#{1,6}\s+", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1 (\2)", cleaned)
    cleaned = re.sub(r"\*\*(.+?)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"__(.+?)__", r"\1", cleaned)
    cleaned = re.sub(r"`([^`]+)`", r"\1", cleaned)
    cleaned = re.sub(r"^(\s*)\*\s+", r"\1- ", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"(^|\s)\*([^*\n]+)\*(?=\s|[.,;:!?]|$)", r"\1\2", cleaned)
    return cleaned.strip()


def _stitch_chunks(chunks: List[str], overlap: int = 200) -> str:
    """Reassemble overlapping chunks into continuous text without duplicating overlaps."""
    if not chunks:
        return ""
    stitched = chunks[0]
    for chunk in chunks[1:]:
        max_k = min(overlap, len(stitched), len(chunk))
        matched = 0
        for k in range(max_k, 0, -1):
            if stitched.endswith(chunk[:k]):
                matched = k
                break
        stitched += chunk[matched:]
    return stitched


def _resolve_node_chunks(
    paper_id: str,
    query: str,
    n_results: int = 4,
    fallback_context: Optional[str] = None,
    prefer_full_ordered: bool = False,
) -> tuple[List[str], Optional[str]]:
    """Query ChromaDB for paper_id, falling back to SQLite node data or inline context."""
    clean_id = (paper_id or "").strip()
    node_data = get_node_data(clean_id)
    node_title = (
        str(node_data.get("title")).strip()
        if isinstance(node_data, dict) and node_data.get("title")
        else None
    )

    if prefer_full_ordered:
        ordered = get_ordered_paper_chunks(clean_id)
        if ordered:
            if len(ordered) <= 12:
                return [_stitch_chunks(ordered)], node_title
            chunks = query_paper_chunks(
                paper_id=clean_id, query=query, n_results=max(n_results, 6)
            )
            if chunks:
                return chunks, node_title

    chunks = query_paper_chunks(paper_id=clean_id, query=query, n_results=n_results)
    if chunks:
        return chunks, node_title

    fallback_text = ""
    if isinstance(node_data, dict):
        fallback_text = _build_node_index_text(
            clean_id,
            str(node_data.get("_node_type") or ""),
            node_data,
        )
    if not fallback_text and fallback_context:
        fallback_text = fallback_context.strip()

    if not fallback_text:
        return [], node_title

    try:
        index_paper_text(paper_id=clean_id, text=fallback_text)
        if prefer_full_ordered:
            ordered = get_ordered_paper_chunks(clean_id)
            if ordered and len(ordered) <= 12:
                return [_stitch_chunks(ordered)], node_title
        reindexed_chunks = query_paper_chunks(
            paper_id=clean_id, query=query, n_results=n_results
        )
        if reindexed_chunks:
            return reindexed_chunks, node_title
    except Exception as e:
        print(f"ChromaDB lazy index warning for {clean_id}: {e}")

    if prefer_full_ordered:
        return [fallback_text], node_title
    return chunk_text(fallback_text)[:n_results], node_title


# --- Graph & Workspace State Endpoints ---

@app.get("/api/workspace/graph")
async def get_workspace_graph():
    return load_graph()

@app.post("/api/workspace/node")
async def persist_node(req: NodeSaveRequest):
    save_node(req.id, req.type, req.position.get("x", 0), req.position.get("y", 0), req.data)
    _try_index_node(req.id, req.type, req.data)
    return {"status": "saved"}

@app.delete("/api/workspace/node/{node_id}")
async def delete_node_endpoint(node_id: str):
    try:
        node_data = get_node_data(node_id)
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM graph_nodes WHERE id = ?", (node_id,))
        cursor.execute("DELETE FROM graph_edges WHERE source = ? OR target = ?", (node_id, node_id))
        conn.commit()
        conn.close()

        delete_paper_chunks(node_id)
        if isinstance(node_data, dict) and node_data.get("paper_id"):
            alt_id = str(node_data["paper_id"])
            if alt_id != node_id:
                delete_paper_chunks(alt_id)

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

    # 2. Clear ChromaDB vectors
    clear_vector_store()

    # 3. Reset uploaded files cache
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
    is_compact_node = req.paper_id.startswith(("result", "note", "discovery"))
    relevant_chunks, _ = _resolve_node_chunks(
        paper_id=req.paper_id,
        query=req.query,
        n_results=6 if is_compact_node else 4,
        fallback_context=req.fallback_context,
        prefer_full_ordered=is_compact_node,
    )

    source_sections: List[str] = []
    if req.paper_id.startswith("result"):
        node_data = get_node_data(req.paper_id)
        stored_sources = (
            node_data.get("sourcePaperIds")
            if isinstance(node_data, dict) and isinstance(node_data.get("sourcePaperIds"), list)
            else []
        )
        source_ids = req.source_paper_ids or [str(sid) for sid in stored_sources if sid]
        for sid in source_ids[:4]:
            src_chunks, src_title = _resolve_node_chunks(
                paper_id=sid,
                query=req.query,
                n_results=2,
            )
            if src_chunks:
                label = src_title or sid
                source_sections.append(f"[Source Paper: {label}]\n" + "\n".join(src_chunks))

    if not relevant_chunks and not source_sections:
        return {
            "reply": "No indexed text, abstract, or summary was found for this item yet. Upload a PDF or ensure metadata/abstract text is available before asking questions."
        }

    context_parts = ["\n\n".join(relevant_chunks)] if relevant_chunks else []
    if source_sections:
        context_parts.append("--- Supporting Excerpts from Connected Papers ---\n" + "\n\n".join(source_sections))
    context_text = "\n\n".join(context_parts)

    prompt = f"""You are a scientific research assistant. Explain and answer the user's question clearly in simple, plain English using ONLY the provided context below. Summarize the key findings, numbers, and takeaways that appear in the context; if a specific requested detail is absent, briefly note that without inventing facts. Write in clean plain text only without Markdown formatting (do not use **, *, #, or backticks).

Context:
{context_text}

User Question: {req.query}
"""
    response = ollama.chat(
        model="llama3.2:3b",
        messages=[{"role": "user", "content": prompt}],
    )
    return {"reply": _clean_markdown(response["message"]["content"])}

@app.post("/api/agents/cross-reference")
async def cross_reference_papers(req: CrossReferenceRequest):
    combined_contexts: List[str] = []
    missing_papers: List[str] = []
    inline_contexts = req.paper_contexts or {}

    for pid in req.paper_ids:
        chunks, node_title = _resolve_node_chunks(
            paper_id=pid,
            query="sample size methodology results effect size hyperparameters abstract findings",
            n_results=3,
            fallback_context=inline_contexts.get(pid),
        )
        heading = f"{node_title} (ID: {pid})" if node_title else f"Paper ID: {pid}"
        if chunks:
            combined_contexts.append(f"--- {heading} ---\n" + "\n".join(chunks))
        else:
            missing_papers.append(heading)

    if not combined_contexts:
        return {
            "comparison_summary": "No indexed text or abstracts were found for the connected papers. Upload their PDFs or add papers with abstracts from Discovery Hub before running cross-reference."
        }

    missing_note = (
        "\n\nNote: No indexed text/abstract was available for: "
        + ", ".join(missing_papers)
        if missing_papers
        else ""
    )

    prompt = f"""You are a scientific literature reviewer. Compare the connected studies below using ONLY the provided Paper Data.
Highlight:
1. Sample size (N) or model dimensions (only if stated in the provided data; otherwise note it is not specified in the available abstract/text)
2. Experimental methodology / conditions
3. Key findings and whether they agree, contradict, or extend each other

Present the result as an easy-to-read structured summary for a student. Do not invent facts or numbers not present in the Paper Data. Write in clean plain text only without Markdown formatting (do not use **, *, #, or backticks).

Paper Data:
{chr(10).join(combined_contexts)}{missing_note}
"""
    response = ollama.chat(
        model="llama3.2:3b",
        messages=[{"role": "user", "content": prompt}],
    )
    return {"comparison_summary": _clean_markdown(response["message"]["content"])}

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
