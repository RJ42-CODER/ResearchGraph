# ResearchGraph 🔬⚡

An interactive, AI-orchestrated research workspace built with **React Flow**, **FastAPI**, **Ollama**, and **SQLite**.

ResearchGraph bridges the gap between reading machine learning research papers, discovering verified scientific literature, and practically validating findings. Users can visually ingest academic PDFs or search global literature databases, extract architectural hyperparameters through local semantic search, synthesize benchmark scripts, and execute them with Human-in-the-Loop (HITL) verification.

---

## What ResearchGraph Does

ResearchGraph transforms static PDF papers and academic citations into an active, visual experimentation graph:

- **Research Discovery Hub:** Search millions of open-access and peer-reviewed works directly within the workspace across **OpenAlex** (primary search), **Crossref** (metadata verification & enrichment), and **Unpaywall** (Open Access full-text resolution).
- **One-Click Literature Graph Ingestion:** Add discovered papers to the infinite React Flow canvas with automatic DOI/OpenAlex ID deduplication and SQLite persistence.
- **Direct PDF Drag-and-Drop:** Upload local PDFs directly onto the infinite canvas with optimistic rendering and background vector chunking.
- **Local Semantic Memory:** Indexes paper sections into ChromaDB using local vector embeddings (`nomic-embed-text`) with strict paper isolation (never substituting unrelated papers).
- **Multi-Agent Hyperparameter Extraction:** LangGraph orchestrates local LLMs (`llama3.2:3b` via Ollama) to extract model dimensions ($d_{\text{model}}$, heads, layers).
- **Automated Benchmark Synthesis:** Synthesizes isolated Python benchmark scripts targeting core operations (e.g., Multi-Head Attention mechanisms).
- **Human-in-the-Loop (HITL) Gate:** Inspect and approve synthesized code prior to running.
- **Subprocess Runner:** Runs scripts in an isolated subprocess, capturing execution latency, standard output, and tracebacks.
- **Persistent Canvas:** Automatically saves nodes, execution metrics, and directional relationship edges (`references`, `synthesized_into`) into SQLite.

---

## System Architecture

```text
[ Academic Discovery Hub ] ──► OpenAlex / Crossref / Unpaywall
         │
         ▼
[ PDF Upload / Canvas Ingestion ]
         │
         ▼
[ Text Chunking & ChromaDB ] ──► Local Embeddings (nomic-embed-text)
         │                       (Strict metadata isolation)
         ▼
[ LangGraph Pipeline ]
   ├─ Reader Agent: Extracts hyperparameters from vector memory
   ├─ Coder Agent: Generates standalone benchmark code
   └─ Evaluator Agent: Performs static security and pattern analysis
         │
         ▼
[ Human-in-the-Loop Gate ] ──► Code inspection & approval
         │
         ▼
[ Local Subprocess Runner ] ──► Local process execution with timeout limits
         │
         ▼
[ React Flow Canvas ] ──► Persistent graph state in SQLite
```

---

## ⚙️ Environment Configuration

ResearchGraph loads configuration from `backend/.env` using `python-dotenv`. An example configuration template is available at `backend/.env.example`.

### Academic API Integrations

| Variable | Description | Default / Requirement |
| :--- | :--- | :--- |
| `OPENALEX_API_URL` | Base endpoint for OpenAlex works queries | `https://api.openalex.org` |
| `OPENALEX_API_KEY` | Optional API key for higher rate limits | Supports keyless queries if omitted |
| `CROSSREF_API_URL` | Base endpoint for Crossref queries | `https://api.crossref.org` |
| `CROSSREF_MAILTO` | Contact email for Crossref Polite Pool | Optional (recommended) |
| `UNPAYWALL_API_URL` | Base endpoint for Unpaywall OA resolution | `https://api.unpaywall.org` |
| `UNPAYWALL_EMAIL` | Required contact email for Unpaywall v2 API | Required for Unpaywall resolution |

*Note on Unpaywall API:* The Unpaywall `/v2/search` endpoint was retired on 18 September 2026. ResearchGraph strictly uses the compliant single-work DOI lookup endpoint (`/v2/{doi}?email=...`).

*Preserved Configuration:* Configuration variables for CORE, DOAJ, and Hugging Face are preserved in `backend/.env.example` for future integrations.

---

## 🔒 Security & System Limitations

- **Subprocess Runner Security Notice:** The existing execution runner (`app/sandbox/runner.py`) uses a local subprocess with static pattern scanning (`BLOCKED_PATTERNS`) and timeout constraints. It is intended solely for local developer benchmarking and is **not a multi-tenant sandboxed security boundary**. Do not expose or deploy this runner publicly without container isolation (e.g., Docker/gVisor/Firecracker).
- **Backend API Isolation:** All external academic API calls and API keys remain strictly server-side. No API keys or credentials are leaked to the browser client.
- **Zero Automatic Downloads:** Discovered paper PDF links are presented as clickable external links; arbitrary remote PDFs are never downloaded or executed automatically.
- **Strict Vector Isolation:** Vector retrieval queries are isolated strictly to the target `paper_id` in ChromaDB; queries never fall back to unrelated papers when a target paper has no indexed chunks.

---

## Getting Started

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **[Ollama](https://ollama.com/)** running locally

Pull the local models:

```bash
ollama pull llama3.2:3b
ollama pull nomic-embed-text
```

---

### Backend Setup & Run

1. Open a terminal in `backend`:
   ```bash
   cd backend
   python -m venv venv
   ```

2. Activate virtual environment:
   - **Windows (PowerShell):** `.\venv\Scripts\activate`
   - **Linux / macOS:** `source venv/bin/activate`

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create configuration:
   ```bash
   cp .env.example .env
   # Edit .env with your email or optional API keys
   ```

5. Run unit tests:
   ```bash
   python -m pytest tests/test_discovery.py
   ```

6. Start the backend API:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   Interactive Swagger documentation is available at `http://localhost:8000/docs`.

---

### Frontend Setup & Run

1. Open a second terminal in `frontend`:
   ```bash
   cd frontend
   npm install
   ```

2. Verify linting & build:
   ```bash
   npm run lint
   npm run build
   ```

3. Start development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to interact with the workspace canvas and Research Discovery Hub.
