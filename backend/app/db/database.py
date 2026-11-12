import sqlite3
import json
import os

DB_PATH = "./data/research_graph.db"
os.makedirs("./data", exist_ok=True)

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS graph_nodes (
            id TEXT PRIMARY KEY,
            node_type TEXT,
            position_x REAL,
            position_y REAL,
            data_json TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS graph_edges (
            id TEXT PRIMARY KEY,
            source TEXT,
            target TEXT,
            label TEXT
        )
    """)
    conn.commit()
    conn.close()

def save_node(node_id: str, node_type: str, x: float, y: float, data: dict):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO graph_nodes (id, node_type, position_x, position_y, data_json)
        VALUES (?, ?, ?, ?, ?)
    """, (node_id, node_type, x, y, json.dumps(data)))
    conn.commit()
    conn.close()

def save_edge(edge_id: str, source: str, target: str, label: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO graph_edges (id, source, target, label)
        VALUES (?, ?, ?, ?)
    """, (edge_id, source, target, label))
    conn.commit()
    conn.close()

def load_graph():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, node_type, position_x, position_y, data_json FROM graph_nodes")
    node_rows = cursor.fetchall()
    nodes = []
    for row in node_rows:
        nodes.append({
            "id": row[0],
            "type": row[1],
            "position": {"x": row[2], "y": row[3]},
            "data": json.loads(row[4])
        })

    cursor.execute("SELECT id, source, target, label FROM graph_edges")
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


def get_node_data(node_id: str) -> dict | None:
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