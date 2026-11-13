import sqlite3
import json
import os
import uuid
from typing import Optional, List, Dict, Any

_CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(os.path.dirname(_CURRENT_DIR))
_DATA_DIR = os.path.join(_BACKEND_DIR, "data")
os.makedirs(_DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(_DATA_DIR, "research_graph.db")


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Projects table for multi-workspace management
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        INSERT OR IGNORE INTO projects (id, name, description)
        VALUES ('default', 'Multi-Paper Workspace', 'Default research project workspace')
    """)

    # 2. Nodes table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS graph_nodes (
            id TEXT PRIMARY KEY,
            node_type TEXT,
            position_x REAL,
            position_y REAL,
            data_json TEXT,
            project_id TEXT DEFAULT 'default'
        )
    """)

    # 3. Edges table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS graph_edges (
            id TEXT PRIMARY KEY,
            source TEXT,
            target TEXT,
            label TEXT,
            project_id TEXT DEFAULT 'default'
        )
    """)

    # Safe column migration if table existed before project_id was added
    cursor.execute("PRAGMA table_info(graph_nodes)")
    node_cols = [col[1] for col in cursor.fetchall()]
    if "project_id" not in node_cols:
        cursor.execute("ALTER TABLE graph_nodes ADD COLUMN project_id TEXT DEFAULT 'default'")

    cursor.execute("PRAGMA table_info(graph_edges)")
    edge_cols = [col[1] for col in cursor.fetchall()]
    if "project_id" not in edge_cols:
        cursor.execute("ALTER TABLE graph_edges ADD COLUMN project_id TEXT DEFAULT 'default'")

    conn.commit()
    conn.close()


def list_projects() -> List[Dict[str, Any]]:
    """List all research workspaces with active node count."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT p.id, p.name, p.description, p.created_at, COUNT(n.id) as node_count
        FROM projects p
        LEFT JOIN graph_nodes n ON p.id = n.project_id
        GROUP BY p.id
        ORDER BY p.created_at ASC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": r[0],
            "name": r[1],
            "description": r[2] or "",
            "created_at": r[3],
            "node_count": r[4],
        }
        for r in rows
    ]


def get_project(project_id: str) -> Optional[Dict[str, Any]]:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, description, created_at FROM projects WHERE id = ?", (project_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    return {
        "id": row[0],
        "name": row[1],
        "description": row[2] or "",
        "created_at": row[3],
    }


def create_project(name: str, description: str = "", project_id: Optional[str] = None) -> Dict[str, Any]:
    pid = project_id or f"proj_{uuid.uuid4().hex[:8]}"
    clean_name = name.strip() if name else "Untitled Project"
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO projects (id, name, description)
        VALUES (?, ?, ?)
    """, (pid, clean_name, description.strip() if description else ""))
    conn.commit()
    conn.close()
    return {"id": pid, "name": clean_name, "description": description or "", "node_count": 0}


def delete_project(project_id: str) -> bool:
    if project_id == "default":
        return False
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM graph_nodes WHERE project_id = ?", (project_id,))
    cursor.execute("DELETE FROM graph_edges WHERE project_id = ?", (project_id,))
    cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    conn.commit()
    conn.close()
    return True


def save_node(node_id: str, node_type: str, x: float, y: float, data: dict, project_id: str = "default"):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO graph_nodes (id, node_type, position_x, position_y, data_json, project_id)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (node_id, node_type, x, y, json.dumps(data), project_id or "default"))
    conn.commit()
    conn.close()


def save_edge(edge_id: str, source: str, target: str, label: str, project_id: str = "default"):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO graph_edges (id, source, target, label, project_id)
        VALUES (?, ?, ?, ?, ?)
    """, (edge_id, source, target, label, project_id or "default"))
    conn.commit()
    conn.close()


def load_graph(project_id: str = "default"):
    pid = project_id or "default"
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT id, node_type, position_x, position_y, data_json FROM graph_nodes WHERE project_id = ?",
        (pid,)
    )
    node_rows = cursor.fetchall()
    nodes = []
    for row in node_rows:
        nodes.append({
            "id": row[0],
            "type": row[1],
            "position": {"x": row[2], "y": row[3]},
            "data": json.loads(row[4])
        })

    cursor.execute(
        "SELECT id, source, target, label FROM graph_edges WHERE project_id = ?",
        (pid,)
    )
    edge_rows = cursor.fetchall()
    edges = []
    for row in edge_rows:
        edges.append({
            "id": row[0],
            "source": row[1],
            "target": row[2],
            "label": row[3],
            "animated": True,
            "style": {"stroke": "#38bdf8", "strokeWidth": 2}
        })

    conn.close()
    return {"nodes": nodes, "edges": edges}


def get_node_data(node_id: str) -> Optional[dict]:
    """Fetch stored JSON data for a workspace node by node ID."""
    clean_id = (node_id or "").strip()
    if not clean_id:
        return None
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT node_type, data_json FROM graph_nodes WHERE id = ?", (clean_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    try:
        data = json.loads(row[1]) if row[1] else {}
        if isinstance(data, dict):
            data.setdefault("_node_type", row[0])
            return data
    except Exception:
        return None
    return None
