# ResearchGraph 🔬⚡
**Autonomous Multi-Agent Literature Discovery, Cross-Paper Synthesis, and Sandbox Experimentation Studio**

ResearchGraph is an interactive, AI-orchestrated research workspace built with **Next.js 16 (React Flow)**, **FastAPI**, **LangGraph**, **Ollama**, **ChromaDB**, and **SQLite**.

ResearchGraph bridges the divide between reading machine learning research papers, discovering verified scientific literature, and practically validating findings. Researchers can visually ingest academic PDFs or search global literature databases, extract domain parameters through local semantic vector memory, synthesize reproducible benchmark scripts, and execute them with Human-in-the-Loop (HITL) verification within an isolated Python sandbox.

---

## What ResearchGraph Does

ResearchGraph transforms static PDF papers and academic citations into an active, visual experimentation studio:

- **Multi-View Research Studio:** Switch seamlessly between 5 dedicated operational views:
  1. **Knowledge Graph (`graph`):** Infinite visual 2D canvas with node creation controls, floating HUD, and interactive relationship edges.
  2. **Home Dashboard (`dashboard`):** Active workspace hero banner, quick stats overview, workspace switcher, and quick-launch actions.
  3. **Research Library (`library`):** Full-screen tabular literature catalog displaying all ingested papers, authors, publication years, DOIs, open-access badges, and citations, with real-time text filtering and local PDF upload fallbacks.
  4. **Experiments & Benchmark Lab (`experiments`):** Centralized history of all empirical simulations run within the workspace, featuring speedup ratios, TPR metrics, latency benchmarks, and collapsible Python reproduction scripts.
  5. **AI Agent Activity (`agents`):** Multi-agent system telemetry showing LangGraph pipeline execution status, ChromaDB vector collection statistics, and Ollama agent health.
- **Floating Canvas HUD Toolbar:**
  - **Instant Search Flyout (`⌘K`):** Live search across all nodes on canvas with automatic viewport panning and focus on selection.
  - **Semantic Filter Pills:** Filter nodes by category (`All`, `Papers`, `Syntheses`, `Gaps`, `Experiments`, `Notes`) with theme-aware hover states.
  - **One-Click Auto-Tidy:** Organizes all canvas nodes into clean, non-overlapping vertical functional columns and immediately saves coordinates to SQLite.
  - **SQLite-Synced Layout Undo & Redo (`⌘Z` / `⌘⇧Z`):** Tracks spatial layout changes, persisting coordinates to SQLite on every step while safely ignoring keystrokes when typing in text fields.
- **Dual-Theme Monochrome Glassmorphism:**
  - Icon-only header toggle (`Sun` / `Moon`) with zero intrusive toasts, persisting in `localStorage`.
  - **Dark Mode:** Deep black canvas (`#000000`), `bg-white/[0.04]` surfaces, `border-white/15`, and subtle white grid dots.
  - **Light Mode:** Crisp paper-white canvas (`#ffffff`), `bg-slate-50` card surfaces, `border-slate-200` borders, and crisp black grid dots (`fill: #000000; opacity: 0.35`).
  - Strict semantic color isolation: Colors are strictly reserved for ReactFlow graph nodes and animated directional edges.
- **Academic Literature Discovery Hub:** Search millions of open-access and peer-reviewed works directly within the workspace across **OpenAlex** (primary academic search), **Crossref** (metadata verification & enrichment), and **Unpaywall** (Open Access full-text resolution).
- **Direct PDF Drag-and-Drop & Vector Memory:** Upload local PDFs directly onto the canvas with background vector chunking into ChromaDB using local embeddings (`nomic-embed-text`) with strict project namespace isolation.
- **Multi-Paper Synthesis & Research Gap Engine:** Connect 2+ papers to discover contradictions, methodological divergence, limitations, and unexplored research gaps. Synthesized results are indexed back into vector storage.
- **User-Directed Experiment Sandbox ("Boss" Agent + HITL):**
  - Reader Agent dynamically extracts domain-specific parameters without forcing Transformer-specific architectures.
  - Coder Agent synthesizes standalone, verified `numpy` CPU benchmark scripts with high-resolution `time.perf_counter()` timing.
  - Evaluator Node pre-validates scripts via static `compile()` and a sandbox dry-run, substituting verified domain fallbacks if errors occur.
  - Human-in-the-Loop modal enables live code editing, parameter adjustment, execution, and plain-English summary generation.
- **Traceable Citations & Citation Inspector:** Grounded Q&A citations (`[Page X]`, `[Abstract]`) are interactive badges; clicking any badge opens verbatim PDF text excerpts with a **"Focus Paper on Canvas"** button.
- **Dual-Path Workspace Export:** Export the complete workspace as a comprehensive **Markdown Research Dossier (`.md`)** or standard **BibTeX Bibliography (`.bib`)**, backed by an instant in-browser client generator fallback.

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
         │                       (Strict project metadata isolation)
         ▼
[ LangGraph Multi-Agent Pipeline ]
   ├─ Reader Agent: Extracts domain parameters from vector memory
   ├─ Coder Agent: Generates standalone benchmark code
   └─ Evaluator Agent: Validates syntax, dry-runs execution, handles fallbacks
         │
         ▼
[ Human-in-the-Loop Gate ] ──► Code inspection, parameter editing & approval
         │
         ▼
[ Subprocess AST Runner ] ──► Local isolated process execution & metric parsing
         │
         ▼
[ Multi-View Studio & React Flow Canvas ] ──► Persistent graph state in SQLite
   ├─ Knowledge Graph Canvas with Floating HUD Toolbar (⌘K, Tidy, ⌘Z Undo/Redo)
   ├─ Home Dashboard & Workspace Switcher
   ├─ Research Library (Tabular Paper Catalog)
   ├─ Experiments & Benchmark Lab
   └─ Dual-Theme Monochrome Glassmorphism (Dark / Light)
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

---

## 🔒 Security & System Limitations

- **Subprocess Runner Security Notice:** The execution runner (`app/sandbox/runner.py`) uses a local subprocess with static AST pattern scanning (`BLOCKED_PATTERNS`) and timeout constraints. It is intended for local developer benchmarking and is **not a multi-tenant sandboxed security boundary**. Do not expose or deploy this runner publicly without container isolation (e.g., Docker/gVisor/Firecracker).
- **Backend API Isolation:** All external academic API calls and API keys remain strictly server-side. No API keys or credentials are leaked to the browser client.
- **Zero Automatic Downloads:** Discovered paper PDF links are presented as clickable external links; arbitrary remote PDFs are never downloaded or executed automatically.
- **Strict Vector Isolation:** Vector retrieval queries are isolated strictly to the target `project_id` and `paper_id` in ChromaDB; queries never cross-contaminate unrelated workspaces or papers.

---

## Getting Started

### Prerequisites

- **Python 3.10+** (Tested on Python 3.13)
- **Node.js 18+** (Tested on Node.js 20+)
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
   # Edit .env with your contact email for Crossref / Unpaywall
   ```

5. Run test suite:
   ```bash
   # Run vector indexing, sandbox & export tests (12 tests)
   $env:PYTHONPATH="."; python -m unittest tests.test_vector_indexing -v
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

2. Run typecheck & build:
   ```bash
   npx tsc --noEmit
   npm run build
   ```

3. Start development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to interact with ResearchGraph.

---

## 📁 Repository Structure

```
ResearchGraph/
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   └── pipeline.py          # LangGraph multi-agent synthesis & evaluator
│   │   ├── api/
│   │   │   ├── discovery.py         # OpenAlex, Crossref & Unpaywall endpoints
│   │   │   └── papers.py            # PDF upload & background chunk extraction
│   │   ├── db/
│   │   │   ├── database.py          # SQLite schema, project CRUD & node persistence
│   │   │   └── vector_store.py      # ChromaDB client, overlapping chunker & queries
│   │   ├── sandbox/
│   │   │   └── runner.py            # AST-checked subprocess execution & metric parser
│   │   └── main.py                  # FastAPI router, export generator & citation API
│   ├── tests/
│   │   ├── test_discovery.py        # Academic API mocks and fallback tests
│   │   └── test_vector_indexing.py  # 12-test suite for memory, sandbox & exports
│   └── requirements.txt             # FastAPI, LangGraph, ChromaDB, pypdf
├── frontend/
│   ├── app/
│   │   ├── globals.css              # Monochrome tokens, light/dark themes, hover protection
│   │   ├── layout.tsx               # Poppins font configuration & root metadata
│   │   └── page.tsx                 # Multi-view orchestration, ReactFlow canvas, drawers
│   ├── components/
│   │   ├── CanvasEmptyState.tsx     # Clean empty-state view with one-click actions
│   │   ├── CitationInspectorModal.tsx # Verbatim page excerpt inspector & canvas focus
│   │   ├── CodeExperimentNode.tsx   # Canvas node displaying validated benchmarks
│   │   ├── ConfirmModal.tsx         # Accessible confirmation dialog for destructive actions
│   │   ├── DiscoveryDrawer.tsx      # Academic literature discovery search UI
│   │   ├── DiscoveryNode.tsx        # Canvas node for discovered papers
│   │   ├── ExperimentModal.tsx      # HITL review & execution sandbox modal
│   │   ├── ExperimentsStudio.tsx    # Dedicated lab view for simulation run history
│   │   ├── ExportModal.tsx          # Export dialog for Markdown and BibTeX
│   │   ├── FloatingCanvasToolbar.tsx # Floating HUD toolbar: Search flyout, filters, tidy, undo/redo
│   │   ├── FormattedPlainText.tsx   # Markdown table & citation badge parser
│   │   ├── HomeDashboard.tsx        # Overview dashboard with workspace switcher & metrics
│   │   ├── NodeDetailsInspector.tsx # Flyout inspector for selected node attributes
│   │   ├── PaperNode.tsx            # Canvas node for indexed research papers
│   │   ├── ResearchLibrary.tsx      # Tabular literature catalog with search & filters
│   │   ├── ResizableNodeFrame.tsx   # Interactive resize handles for graph nodes
│   │   ├── SettingsModal.tsx        # Studio preferences & ChromaDB memory inspector
│   │   ├── SidebarNav.tsx           # Multi-view sidebar navigation
│   │   ├── Toast.tsx                # Non-intrusive action notifications
│   │   └── WorkspaceNodes.tsx       # Notes, syntheses, and research gap nodes
│   └── package.json                 # Next.js 16, ReactFlow, Tailwind CSS 4 dependencies
├── FINAL_REPORT.md                  # Comprehensive technical project final report
└── README.md                        # Quickstart documentation & system guide
```

---

## License

This project is licensed under the Apache 2.0 License.
