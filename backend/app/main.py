import os
import re
import sqlite3
import shutil
from typing import Optional, List, Dict

from fastapi import FastAPI, Response, Query
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
    list_projects,
    create_project,
    delete_project,
    get_project,
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

OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
OLLAMA_KEEP_ALIVE = os.getenv("OLLAMA_KEEP_ALIVE", "1h")
OLLAMA_THREAD_COUNT = int(os.getenv("OLLAMA_NUM_THREADS", "8"))

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

class ResearchGapRequest(BaseModel):
    paper_ids: List[str]
    paper_contexts: Optional[Dict[str, str]] = None

class RunWorkflowRequest(BaseModel):
    paper_id: Optional[str] = None
    paper_text: Optional[str] = None
    user_goal: Optional[str] = None

class ExecuteCodeRequest(BaseModel):
    code: str

class ProjectCreateRequest(BaseModel):
    name: str
    description: Optional[str] = ""

class NodeSaveRequest(BaseModel):
    id: str
    type: str = "default"
    position: dict
    data: dict
    project_id: Optional[str] = "default"

class EdgeSaveRequest(BaseModel):
    id: str
    source: str
    target: str
    label: str
    project_id: Optional[str] = "default"


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

    is_gap = effective_type in ("gap", "researchGap") or node_id.startswith("gap")
    if is_gap:
        title = str(data.get("title") or "Research Gap Discovery").strip()
        summary = str(data.get("summary") or data.get("gaps") or "").strip()
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


def _try_index_node(node_id: str, node_type: str, data: dict, project_id: str = "default") -> None:
    """Best-effort index of non-PDF workspace nodes into ChromaDB."""
    target_id = str(data.get("paper_id") or node_id).strip()
    text = _build_node_index_text(node_id, node_type, data)
    if not target_id or not text:
        return
    try:
        index_paper_text(paper_id=target_id, text=text, project_id=project_id)
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

@app.get("/api/workspace/projects")
async def get_projects():
    """List all workspace projects with active node counts."""
    return list_projects()

@app.post("/api/workspace/projects")
async def create_new_project(req: ProjectCreateRequest):
    """Create a new research project workspace."""
    return create_project(name=req.name, description=req.description or "")

@app.delete("/api/workspace/projects/{project_id}")
async def remove_project(project_id: str):
    """Delete a workspace project and all its nodes and edges."""
    if project_id == "default":
        return {"status": "error", "message": "Cannot delete the default workspace."}
    success = delete_project(project_id)
    clear_vector_store(project_id=project_id)
    return {"status": "deleted" if success else "not_found", "project_id": project_id}

@app.get("/api/workspace/graph")
async def get_workspace_graph(project_id: str = "default"):
    return load_graph(project_id=project_id)

@app.post("/api/workspace/node")
async def persist_node(req: NodeSaveRequest):
    pid = req.project_id or "default"
    save_node(req.id, req.type, req.position.get("x", 0), req.position.get("y", 0), req.data, project_id=pid)
    _try_index_node(req.id, req.type, req.data, project_id=pid)
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
    save_edge(req.id, req.source, req.target, req.label, project_id=req.project_id or "default")
    return {"status": "saved"}

@app.delete("/api/workspace/reset")
async def reset_workspace(project_id: str = "default"):
    pid = project_id or "default"
    # 1. Clear SQLite tables for this specific project
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM graph_nodes WHERE project_id = ?", (pid,))
        cursor.execute("DELETE FROM graph_edges WHERE project_id = ?", (pid,))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Database reset error for project {pid}: {e}")

    # 2. Clear ChromaDB vectors for this project
    clear_vector_store(project_id=pid)

    return {"status": "success", "message": f"Workspace '{pid}' reset completely"}


# --- Traceable Citations & Project Export ---

def _slugify(text: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_\-\s]", "", text or "project")
    return re.sub(r"[\s\-]+", "_", cleaned).strip("_") or "research_project"


def _format_bibtex_key(paper: dict) -> str:
    title = str(paper.get("title") or paper.get("label") or "paper").strip()
    authors = paper.get("authors")
    year = str(paper.get("year") or "2024").strip()

    first_author = ""
    if isinstance(authors, list) and len(authors) > 0:
        first_author = str(authors[0])
    elif isinstance(authors, str) and authors.strip():
        first_author = authors.split(",")[0].split(" and ")[0]

    first_author_clean = re.sub(r"[^a-zA-Z]", "", first_author.split()[-1] if first_author.split() else "")
    first_author_clean = first_author_clean.lower() or "ref"

    title_words = [
        w.lower()
        for w in re.findall(r"[a-zA-Z0-9]+", title)
        if len(w) > 3 and w.lower() not in {"from", "with", "that", "this", "into", "their", "paper"}
    ]
    keyword = title_words[0] if title_words else "study"

    clean_year = re.search(r"\d{4}", year)
    yr = clean_year.group(0) if clean_year else "2024"
    return f"{first_author_clean}{yr}{keyword}"


def generate_bibtex_export(project: dict, nodes: list) -> str:
    from datetime import datetime, timezone
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    papers = []
    for n in nodes:
        ntype = n.get("type", "")
        nid = n.get("id", "")
        if ntype in ("paper", "uploadedPaper", "discovery") or nid.startswith(("paper", "discovery")):
            papers.append(n)

    lines = [
        "% ====================================================================",
        "% BibTeX Bibliography Export - ResearchGraph",
        f"% Project: {project.get('name', 'Research Workspace')}",
        f"% Generated: {now_str}",
        f"% Total Papers: {len(papers)}",
        "% ====================================================================",
        "",
    ]

    if not papers:
        lines.append("% No papers currently indexed in this workspace.")
        return "\n".join(lines)

    seen_keys = set()
    for n in papers:
        data = n.get("data", {})
        title = (data.get("title") or data.get("label") or n.get("id", "Untitled")).strip()
        title_escaped = title.replace("{", "\\{").replace("}", "\\}")

        base_key = _format_bibtex_key(data)
        cite_key = base_key
        counter = 1
        while cite_key in seen_keys:
            cite_key = f"{base_key}_{counter}"
            counter += 1
        seen_keys.add(cite_key)

        raw_authors = data.get("authors")
        if isinstance(raw_authors, list):
            authors_str = " and ".join(str(a).strip() for a in raw_authors if str(a).strip())
        elif isinstance(raw_authors, str) and raw_authors.strip():
            authors_str = raw_authors.strip()
        else:
            authors_str = "ResearchGraph Contributor"

        year_str = str(data.get("year") or "").strip()
        year_match = re.search(r"\d{4}", year_str)
        year_val = year_match.group(0) if year_match else "2024"

        doi = str(data.get("doi") or "").strip()
        url = str(data.get("landing_page_url") or data.get("pdf_url") or data.get("url") or "").strip()
        if not url and doi:
            url = f"https://doi.org/{doi}"

        pub = str(data.get("publication") or "").strip()
        if not pub:
            if "arxiv" in title.lower() or "arxiv" in url.lower() or re.search(r"\d{4}\.\d{4,5}", title):
                pub = "arXiv preprint"
            else:
                pub = "ResearchGraph Literature Index"

        lines.append(f"@article{{{cite_key},")
        lines.append(f"  title = {{{{{title_escaped}}}}},")
        lines.append(f"  author = {{{authors_str}}},")
        lines.append(f"  journal = {{{pub}}},")
        lines.append(f"  year = {{{year_val}}},")
        if doi:
            lines.append(f"  doi = {{{doi}}},")
        if url:
            lines.append(f"  url = {{{url}}},")

        abstract = str(data.get("abstract") or "").strip()
        if abstract:
            clean_abs = " ".join(abstract.split())
            if len(clean_abs) > 500:
                clean_abs = clean_abs[:497] + "..."
            clean_abs = clean_abs.replace("{", "\\{").replace("}", "\\}")
            lines.append(f"  abstract = {{{clean_abs}}},")

        lines.append(f"  note = {{Indexed into ResearchGraph workspace: {project.get('name', '')}}}")
        lines.append("}\n")

    return "\n".join(lines)


def generate_markdown_export(project: dict, nodes: list, edges: list) -> str:
    from datetime import datetime, timezone
    now_str = datetime.now(timezone.utc).strftime("%B %d, %Y")

    papers = []
    notes = []
    syntheses = []
    gaps = []
    experiments = []

    for n in nodes:
        ntype = n.get("type", "")
        nid = n.get("id", "")
        data = n.get("data", {})
        if ntype in ("paper", "uploadedPaper", "discovery") or nid.startswith(("paper", "discovery")):
            papers.append(n)
        elif ntype == "note" or nid.startswith("note") or data.get("type") == "note":
            notes.append(n)
        elif ntype in ("synth", "synthesisResult") or nid.startswith("synth") or "taskMode" in data or "comparison_summary" in data:
            if data.get("taskMode") == "gaps" or "gaps_summary" in data:
                gaps.append(n)
            else:
                syntheses.append(n)
        elif ntype in ("gap", "researchGap") or nid.startswith("gap") or "gaps_summary" in data:
            gaps.append(n)
        elif ntype in ("experiment", "result", "codeExperiment") or nid.startswith(("exp", "result")):
            experiments.append(n)

    md = []
    pname = project.get("name", "Research Workspace")
    pdesc = project.get("description", "")

    md.append(f"# Research Dossier: {pname}")
    md.append(f"*Generated automatically by **ResearchGraph** on {now_str}*")
    md.append("")
    if pdesc:
        md.append(f"**Project Scope**: {pdesc}")
        md.append("")

    md.append("## Executive Overview")
    md.append(
        f"This research workspace integrates **{len(nodes)} active artifacts** across the research graph: "
        f"{len(papers)} connected papers, {len(notes)} user notes, {len(syntheses)} cross-paper syntheses, "
        f"{len(gaps)} research gap analyses, and {len(experiments)} verified sandbox experiments."
    )
    md.append("")
    md.append("---")
    md.append("")

    # 1. Connected Literature
    md.append(f"## 1. Connected Literature & Papers ({len(papers)})")
    if not papers:
        md.append("*No papers connected in this workspace.*")
    else:
        for idx, p in enumerate(papers, 1):
            data = p.get("data", {})
            title = data.get("title") or data.get("label") or p.get("id")
            authors = data.get("authors")
            if isinstance(authors, list):
                author_line = ", ".join(str(a) for a in authors)
            else:
                author_line = str(authors or "Not specified")
            year = str(data.get("year") or "N/A")
            doi = data.get("doi")
            url = data.get("landing_page_url") or data.get("pdf_url") or data.get("url")
            abstract = data.get("abstract") or data.get("summary") or ""

            md.append(f"### 1.{idx} {title}")
            md.append(f"- **Node ID**: `{p.get('id')}`")
            md.append(f"- **Authors**: {author_line}")
            md.append(f"- **Publication Year**: {year}")
            if doi:
                md.append(f"- **DOI**: [{doi}](https://doi.org/{doi})")
            if url:
                md.append(f"- **Primary Link**: [Access Document]({url})")
            if abstract:
                md.append("")
                md.append("> **Abstract / Overview**:")
                clean_abs = "\n> ".join(abstract.strip().split("\n"))
                md.append(f"> {clean_abs}")
            md.append("")

    md.append("---")
    md.append("")

    # 2. Research Notes
    md.append(f"## 2. Research Notes & Annotations ({len(notes)})")
    if not notes:
        md.append("*No research notes recorded.*")
    else:
        for idx, note in enumerate(notes, 1):
            data = note.get("data", {})
            title = data.get("title") or data.get("label") or f"Note #{idx}"
            text = data.get("text") or data.get("content") or data.get("summary") or ""
            md.append(f"### 2.{idx} 📝 {title}")
            if text:
                md.append(f"{text.strip()}")
            else:
                md.append("*Empty note.*")
            md.append("")

    md.append("---")
    md.append("")

    # 3. Cross-Paper Syntheses & Gap Discoveries
    md.append("## 3. Cross-Paper Syntheses & Research Gaps")
    if not syntheses and not gaps:
        md.append("*No cross-paper syntheses or gap analyses generated.*")
    else:
        if syntheses:
            md.append(f"### Multi-Paper Comparative Syntheses ({len(syntheses)})")
            for idx, s in enumerate(syntheses, 1):
                data = s.get("data", {})
                title = data.get("title") or data.get("label") or f"Synthesis #{idx}"
                summary = data.get("comparison_summary") or data.get("summary") or ""
                md.append(f"#### 3.A.{idx} 🔬 {title}")
                if summary:
                    md.append(summary.strip())
                md.append("")

        if gaps:
            md.append(f"### Identified Research Gaps & Divergent Findings ({len(gaps)})")
            for idx, g in enumerate(gaps, 1):
                data = g.get("data", {})
                title = data.get("title") or data.get("label") or f"Research Gap Discovery #{idx}"
                gaps_sum = data.get("gaps_summary") or data.get("summary") or ""
                contradictions = data.get("contradictions")
                limitations = data.get("limitations")
                future = data.get("future_directions")

                md.append(f"#### 3.B.{idx} 🧩 {title}")
                if contradictions:
                    md.append(f"**Contradictions & Divergent Findings**:\n{contradictions}\n")
                if limitations:
                    md.append(f"**Methodological Limitations**:\n{limitations}\n")
                if future:
                    md.append(f"**Unaddressed Directions**:\n{future}\n")
                if gaps_sum and not (contradictions or limitations or future):
                    md.append(gaps_sum.strip())
                md.append("")

    md.append("---")
    md.append("")

    # 4. Sandbox Simulations & Experimental Benchmarks
    md.append(f"## 4. Empirical Sandbox Experiments & Benchmarks ({len(experiments)})")
    if not experiments:
        md.append("*No sandbox experiments executed.*")
    else:
        for idx, exp in enumerate(experiments, 1):
            data = exp.get("data", {})
            label = data.get("label") or data.get("goal") or f"Experiment #{idx}"
            status = data.get("status", "unknown").upper()
            primary_metric = data.get("primaryMetric") or data.get("metric") or "N/A"
            summary = data.get("summary") or data.get("plain_english_analysis") or ""
            code = data.get("code") or data.get("generated_code") or ""
            opt_ms = data.get("optimized_ms") or data.get("latency_ms")
            base_ms = data.get("baseline_ms")
            speedup = data.get("speedup")

            md.append(f"### 4.{idx} ⚡ {label}")
            md.append(f"- **Execution Status**: `{status}`")
            md.append(f"- **Primary Domain Metric**: `{primary_metric}`")
            if opt_ms is not None:
                md.append(f"- **Simulated Latency**: Proposed {opt_ms}ms" + (f" vs Baseline {base_ms}ms" if base_ms else "") + (f" ({speedup})" if speedup else ""))
            if summary:
                md.append(f"- **Plain-English Analysis**:\n  > {summary.strip()}")
            if code:
                md.append("\n<details>\n<summary><b>View Python Simulation Benchmark Script</b></summary>\n")
                md.append(f"```python\n{code.strip()}\n```\n</details>\n")
            md.append("")

    md.append("---")
    md.append("\n*Export generated with ResearchGraph • Traceable Citations & Cross-Paper Analysis*")
    return "\n".join(md)


@app.get("/api/workspace/export")
async def export_workspace(
    project_id: str = "default",
    format: str = "markdown",
    download: bool = False,
):
    pid = (project_id or "default").strip()
    project = get_project(pid) or {"id": pid, "name": "Research Workspace", "description": ""}
    graph = load_graph(pid)
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])

    is_bib = format.lower() == "bibtex"
    if is_bib:
        content = generate_bibtex_export(project, nodes)
        filename = f"{_slugify(project['name'])}_citations.bib"
        media_type = "application/x-bibtex"
    else:
        content = generate_markdown_export(project, nodes, edges)
        filename = f"{_slugify(project['name'])}_dossier.md"
        media_type = "text/markdown"

    if download:
        return Response(
            content=content,
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    return {
        "status": "success",
        "format": "bibtex" if is_bib else "markdown",
        "filename": filename,
        "content": content,
    }


@app.get("/api/papers/citation-excerpt")
async def get_citation_excerpt(
    paper_id: str,
    page: str = "1",
    project_id: str = "default",
):
    clean_id = (paper_id or "").strip()
    if not clean_id:
        return {"status": "error", "message": "paper_id is required"}

    # Resolve target paper if given an experiment, result, or note node
    target_id = clean_id
    node_data = get_node_data(clean_id) or {}
    if clean_id.startswith(("exp", "result", "synth", "note")):
        target_id = str(node_data.get("targetPaperId") or clean_id)
    target_data = get_node_data(target_id) if target_id != clean_id else node_data
    if not target_data:
        target_data = node_data

    paper_title = str(
        target_data.get("title")
        or target_data.get("label")
        or clean_id
    ).strip()

    # Parse requested page number
    clean_page_str = re.sub(r"[^\w\s]", "", page).strip()
    is_abstract_req = "abstract" in clean_page_str.lower()
    page_num = 1
    page_match = re.search(r"\d+", clean_page_str)
    if page_match:
        page_num = max(1, int(page_match.group(0)))

    # 1. Check if a local PDF exists in data/uploads
    upload_dir = "./data/uploads"
    pdf_path = None
    if os.path.exists(upload_dir):
        for fname in os.listdir(upload_dir):
            if fname.lower().endswith(".pdf") and (
                fname.startswith(f"{target_id}_")
                or fname.startswith(f"{clean_id}_")
                or (target_data.get("paper_id") and fname.startswith(f"{target_data.get('paper_id')}_"))
            ):
                pdf_path = os.path.join(upload_dir, fname)
                break

    if pdf_path and os.path.isfile(pdf_path):
        try:
            import pypdf
            reader = pypdf.PdfReader(pdf_path)
            total_pages = len(reader.pages)
            target_idx = 0 if is_abstract_req else min(total_pages - 1, max(0, page_num - 1))
            page_text = reader.pages[target_idx].extract_text() or ""
            if page_text.strip():
                return {
                    "status": "success",
                    "paper_id": target_id,
                    "paper_title": paper_title,
                    "page": str(target_idx + 1),
                    "citation_label": "Abstract" if is_abstract_req else f"Page {target_idx + 1}",
                    "excerpt": page_text.strip()[:2400],
                    "source_type": "pdf_page",
                    "total_pages": total_pages,
                }
        except Exception as e:
            print(f"Citation PDF extract error: {e}")

    # 2. Check ChromaDB ordered chunks for [Page X] tag or chunk index
    for pid in [target_id, clean_id, str(target_data.get("paper_id") or "")]:
        if not pid:
            continue
        chunks = get_ordered_paper_chunks(pid)
        if chunks:
            page_tag = f"[Page {page_num}]"
            matching_chunk = next((c for c in chunks if page_tag in c), None)
            if matching_chunk:
                return {
                    "status": "success",
                    "paper_id": target_id,
                    "paper_title": paper_title,
                    "page": str(page_num),
                    "citation_label": "Abstract" if is_abstract_req else f"Page {page_num}",
                    "excerpt": matching_chunk.strip()[:2400],
                    "source_type": "indexed_chunk",
                    "total_pages": len(chunks),
                }
            chunk_idx = min(len(chunks) - 1, max(0, page_num - 1))
            return {
                "status": "success",
                "paper_id": target_id,
                "paper_title": paper_title,
                "page": str(page_num),
                "citation_label": "Abstract" if is_abstract_req else f"Page {page_num}",
                "excerpt": chunks[chunk_idx].strip()[:2400],
                "source_type": "indexed_chunk",
                "total_pages": len(chunks),
            }

    # 3. Fallback to abstract / summary from node metadata
    abstract = str(target_data.get("abstract") or target_data.get("summary") or "").strip()
    if abstract:
        return {
            "status": "success",
            "paper_id": target_id,
            "paper_title": paper_title,
            "page": "1" if page_num == 1 else str(page_num),
            "citation_label": "Abstract & Overview" if is_abstract_req else f"Page {page_num} (Abstract & Overview)",
            "excerpt": abstract[:2400],
            "source_type": "abstract_overview",
            "total_pages": 1,
        }

    return {
        "status": "not_found",
        "paper_id": target_id,
        "paper_title": paper_title,
        "page": str(page_num),
        "citation_label": f"Page {page_num}",
        "excerpt": "No direct text excerpt indexed for this page yet. Upload the full PDF to view traceable page citations.",
        "source_type": "none",
        "total_pages": 0,
    }


# --- Multi-Agent Orchestration & Chat ---

@app.post("/api/agents/chat")
async def chat_with_paper(req: ChatRequest):
    clean_id = (req.paper_id or "").strip()
    node_data = get_node_data(clean_id) or {}

    # If this is an experiment, result, or compact node, resolve underlying target paper ID
    target_paper_id = clean_id
    if clean_id.startswith(("exp", "result", "synth", "note")):
        target_paper_id = str(node_data.get("targetPaperId") or clean_id)
    target_node_data = get_node_data(target_paper_id) if target_paper_id != clean_id else node_data
    if not target_node_data and clean_id != target_paper_id:
        target_node_data = node_data

    # Extract paper identity and abstract
    paper_title = (
        str(target_node_data.get("title") or target_node_data.get("label") or "").strip()
        if isinstance(target_node_data, dict)
        else ""
    )
    paper_abstract = (
        str(target_node_data.get("abstract") or "").strip()
        if isinstance(target_node_data, dict)
        else ""
    )

    # If missing from node_data, attempt to extract from fallback_context
    if not paper_title and req.fallback_context:
        title_match = re.search(r"Paper Title:\s*([^\n]+)", req.fallback_context)
        if title_match:
            paper_title = title_match.group(1).strip()
    if not paper_abstract and req.fallback_context:
        abs_match = re.search(r"Abstract:\s*([^\n]+(?:\n(?!(?:Benchmark|Summary|Primary|Optimized|Baseline|Speedup|Paper Title:))[^\n]+)*)", req.fallback_context)
        if abs_match:
            paper_abstract = abs_match.group(1).strip()

    # Always fetch Page 1 / leading chunk from ChromaDB
    page1_chunk = ""
    for pid in [target_paper_id, clean_id]:
        if pid:
            ordered = get_ordered_paper_chunks(pid)
            if ordered:
                page1_chunk = ordered[0]
                break

    # Build mandatory Paper Identity & Abstract block to always anchor the context
    identity_parts = []
    if paper_title:
        identity_parts.append(f"PAPER TITLE: {paper_title}")
    if paper_abstract:
        identity_parts.append(f"PAPER ABSTRACT: {paper_abstract}")
    if page1_chunk and page1_chunk.strip() not in paper_abstract:
        clean_p1 = page1_chunk[:1400].strip()
        identity_parts.append(f"--- PAPER OVERVIEW & PAGE 1 ---\n{clean_p1}")

    paper_identity_block = "\n\n".join(identity_parts)

    is_compact_node = target_paper_id.startswith(("result", "note", "discovery"))
    relevant_chunks, _ = _resolve_node_chunks(
        paper_id=target_paper_id if target_paper_id else req.paper_id,
        query=req.query,
        n_results=6 if is_compact_node else 4,
        fallback_context=req.fallback_context,
        prefer_full_ordered=is_compact_node,
    )

    source_sections: List[str] = []
    if target_paper_id.startswith("result") or req.paper_id.startswith("result"):
        node_data_res = get_node_data(req.paper_id) or get_node_data(target_paper_id) or {}
        stored_sources = (
            node_data_res.get("sourcePaperIds")
            if isinstance(node_data_res, dict) and isinstance(node_data_res.get("sourcePaperIds"), list)
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

    context_sections = []
    if paper_identity_block:
        context_sections.append(paper_identity_block)
    if relevant_chunks:
        filtered_chunks = [c for c in relevant_chunks if c.strip() != page1_chunk.strip()]
        if filtered_chunks:
            context_sections.append("--- RETRIEVED PAPER EXCERPTS ---\n" + "\n\n".join(filtered_chunks))
    if source_sections:
        context_sections.append("--- Supporting Excerpts from Connected Papers ---\n" + "\n\n".join(source_sections))
    if req.fallback_context and req.fallback_context.strip():
        clean_fb = req.fallback_context.strip()
        context_sections.append("--- SANDBOX SIMULATION BENCHMARK DATA ---\n" + clean_fb[:2000])

    if not context_sections:
        return {
            "reply": "No indexed text, abstract, or summary was found for this item yet. Upload a PDF or ensure metadata/abstract text is available before asking questions."
        }

    context_text = "\n\n".join(context_sections)

    system_prompt = (
        "You are an expert scientific literature reviewer and computational research assistant. "
        "Strict Grounding Rules:\n"
        "1. Answer ONLY using facts, definitions, and experimental findings directly stated in the provided Paper Context.\n"
        "2. Cite `[Page X]` (or `[Page 1]` / `[Abstract]`) whenever citing specific claims, numbers, or methods from paper excerpts.\n"
        "3. Maintain strict domain accuracy: NEVER invert an attack paper into a defense paper, or vice versa (e.g., if the paper studies Membership Inference Attacks or LiRA, frame it accurately as an offensive privacy leakage evaluation attack assessing training data vulnerability, not as a defense mechanism).\n"
        "4. Relate sandbox simulation benchmark results directly to the paper's core hypothesis, methods, and empirical findings.\n"
        "5. If a requested detail is absent, state that it is not specified in the available text rather than hallucinating.\n"
        "6. Write in clean plain text only without Markdown formatting (do not use **, *, #, or backticks)."
    )

    user_prompt = f"""Paper Context:
{context_text}

User Question:
{req.query}
"""

    response = ollama.chat(
        model=OLLAMA_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        keep_alive=OLLAMA_KEEP_ALIVE,
        options={
            "num_thread": OLLAMA_THREAD_COUNT,
            "num_predict": 350,
            "num_ctx": 2048,
            "temperature": 0.0,
        },
    )
    return {"reply": _clean_markdown(response["message"]["content"])}

@app.post("/api/agents/cross-reference")
async def cross_reference_papers(req: CrossReferenceRequest):
    combined_contexts: List[str] = []
    missing_papers: List[str] = []
    inline_contexts = req.paper_contexts or {}

    for pid in req.paper_ids:
        node_data = get_node_data(pid)
        node_title = (
            str(node_data.get("title")).strip()
            if isinstance(node_data, dict) and node_data.get("title")
            else None
        )
        abstract = (
            str(node_data.get("abstract") or "").strip()
            if isinstance(node_data, dict)
            else ""
        )
        heading = f"{node_title} (ID: {pid})" if node_title else f"Paper ID: {pid}"

        # Fast path: If the paper has an abstract (e.g. from Discovery Hub), use it directly to save prompt tokens
        if abstract:
            clean_abstract = abstract[:1200]
            combined_contexts.append(f"--- {heading} ---\nAbstract:\n{clean_abstract}")
            continue

        chunks, _ = _resolve_node_chunks(
            paper_id=pid,
            query="sample size methodology results effect size hyperparameters abstract findings",
            n_results=2,
            fallback_context=inline_contexts.get(pid),
        )
        if chunks:
            compact_text = "\n".join(chunks)[:1500]
            combined_contexts.append(f"--- {heading} ---\n" + compact_text)
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
        model=OLLAMA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        keep_alive=OLLAMA_KEEP_ALIVE,
        options={
            "num_thread": OLLAMA_THREAD_COUNT,
            "num_predict": 320,
            "num_ctx": 2048,
            "temperature": 0.1,
        },
    )
    return {"comparison_summary": _clean_markdown(response["message"]["content"])}

@app.post("/api/agents/research-gap")
async def analyze_research_gaps(req: ResearchGapRequest):
    combined_contexts: List[str] = []
    missing_papers: List[str] = []
    inline_contexts = req.paper_contexts or {}

    for pid in req.paper_ids:
        node_data = get_node_data(pid)
        node_title = (
            str(node_data.get("title")).strip()
            if isinstance(node_data, dict) and node_data.get("title")
            else None
        )
        abstract = (
            str(node_data.get("abstract") or "").strip()
            if isinstance(node_data, dict)
            else ""
        )
        heading = f"{node_title} (ID: {pid})" if node_title else f"Paper ID: {pid}"

        # Fast path: use abstract directly if available
        if abstract:
            clean_abstract = abstract[:1200]
            combined_contexts.append(f"--- {heading} ---\nAbstract:\n{clean_abstract}")
            continue

        chunks, _ = _resolve_node_chunks(
            paper_id=pid,
            query="limitations contradictions future work baseline methodology dataset sample size gaps",
            n_results=2,
            fallback_context=inline_contexts.get(pid),
        )
        if chunks:
            compact_text = "\n".join(chunks)[:1500]
            combined_contexts.append(f"--- {heading} ---\n" + compact_text)
        else:
            missing_papers.append(heading)

    if not combined_contexts:
        return {
            "gaps_summary": "No indexed text or abstracts were found for the connected papers. Upload their PDFs or add papers with abstracts from Discovery Hub before running gap analysis."
        }

    missing_note = (
        "\n\nNote: No indexed text/abstract was available for: "
        + ", ".join(missing_papers)
        if missing_papers
        else ""
    )

    prompt = f"""You are a scientific research gap analyst. Compare the connected studies below using ONLY the provided Paper Data.
Identify and present in clean plain English:
1. Contradictions & Divergent Findings (where results, claims, or conclusions conflict or differ)
2. Sample & Methodological Limitations (small sample size N, unaddressed baseline comparisons, hardware or dataset constraints)
3. Unaddressed Research Gaps & Future Directions (what questions remain unanswered by these studies)

Present the findings as clear, structured categories for a researcher. Do not invent numbers or facts not in the Paper Data. Write in clean plain text only without Markdown formatting (do not use **, *, #, or backticks).

Paper Data:
{chr(10).join(combined_contexts)}{missing_note}
"""
    response = ollama.chat(
        model=OLLAMA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        keep_alive=OLLAMA_KEEP_ALIVE,
        options={
            "num_thread": OLLAMA_THREAD_COUNT,
            "num_predict": 350,
            "num_ctx": 2048,
            "temperature": 0.1,
        },
    )
    return {"gaps_summary": _clean_markdown(response["message"]["content"])}

@app.post("/api/agents/run-pipeline")
@app.post("/api/agents/pipeline")
async def trigger_agent_pipeline(req: RunWorkflowRequest):
    retrieved_text = ""
    if req.paper_id:
        search_query = (
            f"{req.user_goal} methodology algorithm architecture parameters"
            if req.user_goal
            else "methodology algorithm architecture parameters"
        )
        chunks = query_paper_chunks(
            paper_id=req.paper_id, 
            query=search_query, 
            n_results=4
        )
        retrieved_text = "\n\n".join(chunks) if chunks else ""
    
    context_text = retrieved_text if retrieved_text else (req.paper_text or "")
    if req.user_goal:
        context_text = f"User Goal: {req.user_goal}\n\nContext:\n{context_text}"

    result = research_graph_pipeline.invoke({
        "paper_text": context_text,
        "user_goal": req.user_goal or "",
    })
    
    return {
        "status": "pending_approval",
        "hyperparameters": result.get("hyperparameters"),
        "generated_code": result.get("generated_code"),
        "eval_status": result.get("eval_status")
    }

@app.post("/api/sandbox/execute")
async def execute_experiment(req: ExecuteCodeRequest):
    return execute_sandboxed_code(req.code)
