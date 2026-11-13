import os
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from app.db import database, vector_store
from app import main as app_main


def run_sync_coro(coro):
    """Drive an async endpoint function that performs no async awaits."""
    try:
        coro.send(None)
    except StopIteration as stop:
        return stop.value
    raise AssertionError("Expected coroutine to finish without suspending")


class FakeCollection:
    """In-memory fake ChromaDB collection for deterministic unit testing."""

    def __init__(self):
        self.records: dict[str, dict] = {}

    def upsert(self, documents, ids, metadatas):
        for doc_id, doc, meta in zip(ids, documents, metadatas):
            self.records[doc_id] = {"document": doc, "metadata": meta}

    def delete(self, where=None, ids=None):
        if ids is not None:
            for doc_id in list(ids):
                self.records.pop(doc_id, None)
            return
        if where:
            to_remove = [
                doc_id
                for doc_id, rec in self.records.items()
                if all(rec["metadata"].get(k) == v for k, v in where.items())
            ]
            for doc_id in to_remove:
                del self.records[doc_id]

    def get(self, where=None, include=None):
        target = (where or {}).get("paper_id")
        items = [
            (doc_id, rec)
            for doc_id, rec in self.records.items()
            if target is None or rec["metadata"].get("paper_id") == target
        ]
        return {
            "ids": [doc_id for doc_id, _ in items],
            "documents": [rec["document"] for _, rec in items],
            "metadatas": [rec["metadata"] for _, rec in items],
        }

    def query(self, query_texts, n_results=4, where=None):
        target = (where or {}).get("paper_id")
        docs = [
            rec["document"]
            for rec in self.records.values()
            if target is None or rec["metadata"].get("paper_id") == target
        ]
        return {"documents": [docs[:n_results]]}


class TestVectorIndexingAndAgentContext(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.test_db_path = os.path.join(self.tmp_dir.name, "test_graph.db")
        self.fake_collection = FakeCollection()

        self.db_patch_1 = patch.object(database, "DB_PATH", self.test_db_path)
        self.db_patch_2 = patch.object(app_main, "DB_PATH", self.test_db_path)
        self.vec_patch = patch.object(vector_store, "collection", self.fake_collection)

        self.db_patch_1.start()
        self.db_patch_2.start()
        self.vec_patch.start()

        database.init_db()

    def tearDown(self):
        self.vec_patch.stop()
        self.db_patch_2.stop()
        self.db_patch_1.stop()
        self.tmp_dir.cleanup()

    def test_persist_discovery_and_result_nodes_index_into_chromadb(self):
        res_discovery = run_sync_coro(
            app_main.persist_node(
                app_main.NodeSaveRequest(
                    id="discovery-10_48550_arxiv_1706_03762",
                    type="discovery",
                    position={"x": 100, "y": 100},
                    data={
                        "paper_id": "discovery-10_48550_arxiv_1706_03762",
                        "title": "Attention Is All You Need",
                        "authors": ["Ashish Vaswani", "Noam Shazeer"],
                        "year": 2017,
                        "abstract": "We propose a new simple network architecture, the Transformer, based solely on attention mechanisms.",
                    },
                )
            )
        )
        self.assertEqual(res_discovery, {"status": "saved"})

        res_result = run_sync_coro(
            app_main.persist_node(
                app_main.NodeSaveRequest(
                    id="result-12345",
                    type="result",
                    position={"x": 500, "y": 200},
                    data={
                        "title": "Synthesis Results",
                        "summary": "Both studies apply self-attention mechanisms, extending Transformers from machine translation to speech separation.",
                        "paperCount": 2,
                    },
                )
            )
        )
        self.assertEqual(res_result, {"status": "saved"})

        discovery_chunks = vector_store.query_paper_chunks(
            "discovery-10_48550_arxiv_1706_03762", "Transformer"
        )
        result_chunks = vector_store.query_paper_chunks("result-12345", "speech separation")
        self.assertTrue(any("Transformer" in c for c in discovery_chunks))
        self.assertTrue(any("speech separation" in c for c in result_chunks))

    def test_chat_uses_chromadb_and_fallback_context_without_hallucinating(self):
        run_sync_coro(
            app_main.persist_node(
                app_main.NodeSaveRequest(
                    id="result-999",
                    type="result",
                    position={"x": 0, "y": 0},
                    data={
                        "title": "Synthesis Results",
                        "summary": "Paper A uses 8 attention heads while Paper B adapts Conformer blocks for speech separation.",
                    },
                )
            )
        )

        with patch.object(
            app_main.ollama,
            "chat",
            return_value={"message": {"content": "Paper A uses 8 attention heads."}},
        ) as mock_chat:
            resp = run_sync_coro(
                app_main.chat_with_paper(
                    app_main.ChatRequest(
                        paper_id="result-999",
                        query="What does Paper A use?",
                    )
                )
            )
            self.assertEqual(resp["reply"], "Paper A uses 8 attention heads.")
            messages = mock_chat.call_args.kwargs["messages"]
            prompt_sent = " ".join(m["content"] for m in messages)
            self.assertIn("8 attention heads", prompt_sent)
            self.assertEqual(mock_chat.call_args.kwargs["options"]["temperature"], 0.0)

        # Also verify multi-chunk result node stitches full ordered context and pulls source papers
        long_summary = ("Part A intro. " * 45) + ("Key Finding: 92% accuracy. " * 25) + ("Part C conclusion. " * 40)
        vector_store.index_paper_text("src-paper-1", "Source Paper 1 achieved 92% accuracy on packet capture.")
        run_sync_coro(
            app_main.persist_node(
                app_main.NodeSaveRequest(
                    id="result-full",
                    type="result",
                    position={"x": 0, "y": 0},
                    data={
                        "title": "Synthesis Results",
                        "summary": long_summary,
                        "sourcePaperIds": ["src-paper-1"],
                    },
                )
            )
        )
        with patch.object(
            app_main.ollama,
            "chat",
            return_value={"message": {"content": "Both achieved 92% accuracy."}},
        ) as mock_chat_full:
            resp_full = run_sync_coro(
                app_main.chat_with_paper(
                    app_main.ChatRequest(
                        paper_id="result-full",
                        query="explain its results in simple words",
                    )
                )
            )
            self.assertEqual(resp_full["reply"], "Both achieved 92% accuracy.")
            messages_full = mock_chat_full.call_args.kwargs["messages"]
            full_prompt = " ".join(m["content"] for m in messages_full)
            self.assertIn("Key Finding: 92% accuracy.", full_prompt)
            self.assertIn("Supporting Excerpts from Connected Papers", full_prompt)

        # Unknown node with no fallback should not call ollama
        with patch.object(app_main.ollama, "chat") as mock_chat_empty:
            resp_empty = run_sync_coro(
                app_main.chat_with_paper(
                    app_main.ChatRequest(
                        paper_id="missing-id",
                        query="Explain this",
                    )
                )
            )
            mock_chat_empty.assert_not_called()
            self.assertIn("No indexed text", resp_empty["reply"])

    def test_cross_reference_uses_inline_fallback_and_indexes_it(self):
        with patch.object(
            app_main.ollama,
            "chat",
            return_value={"message": {"content": "Comparison of Transformer papers."}},
        ) as mock_chat:
            resp = run_sync_coro(
                app_main.cross_reference_papers(
                    app_main.CrossReferenceRequest(
                        paper_ids=["disc-1", "disc-2"],
                        paper_contexts={
                            "disc-1": "Title: Attention Is All You Need\nAbstract: Introduces the Transformer with multi-head attention.",
                            "disc-2": "Title: Attention Is All You Need In Speech Separation\nAbstract: Applies dual-path Transformer blocks to speech.",
                        },
                    )
                )
            )
            self.assertEqual(resp["comparison_summary"], "Comparison of Transformer papers.")
            prompt_sent = mock_chat.call_args.kwargs["messages"][0]["content"]
            self.assertIn("multi-head attention", prompt_sent)
            self.assertIn("dual-path Transformer", prompt_sent)

        # Verify lazy indexing stored them in ChromaDB
        self.assertTrue(len(vector_store.query_paper_chunks("disc-1", "Transformer")) > 0)
        self.assertTrue(len(vector_store.query_paper_chunks("disc-2", "speech")) > 0)

    def test_markdown_is_cleaned_from_responses(self):
        raw = "### Overview\n**1. Sample Size (N)**\n* Tested `Conformer` on [Dataset](https://example.com) with *high* accuracy."
        cleaned = app_main._clean_markdown(raw)
        self.assertNotIn("**", cleaned)
        self.assertNotIn("###", cleaned)
        self.assertNotIn("`", cleaned)
        self.assertIn("1. Sample Size (N)", cleaned)
        self.assertIn("- Tested Conformer on Dataset (https://example.com) with high accuracy.", cleaned)

    def test_delete_and_reset_clear_chromadb(self):
        vector_store.index_paper_text("result-del", "Temporary synthesis summary")
        self.assertTrue(len(vector_store.query_paper_chunks("result-del", "Temporary")) > 0)

        run_sync_coro(app_main.delete_node_endpoint("result-del"))
        self.assertEqual(vector_store.query_paper_chunks("result-del", "Temporary"), [])

        vector_store.index_paper_text("disc-reset", "Another paper abstract")
        run_sync_coro(app_main.reset_workspace())
        self.assertEqual(vector_store.query_paper_chunks("disc-reset", "abstract"), [])
        conn = sqlite3.connect(self.test_db_path)
        count = conn.execute("SELECT COUNT(*) FROM graph_nodes").fetchone()[0]
        conn.close()
        self.assertEqual(count, 0)

    def test_project_crud_and_workspace_isolation(self):
        # 1. Default project exists
        projects = run_sync_coro(app_main.get_projects())
        self.assertTrue(any(p["id"] == "default" for p in projects))

        # 2. Create a new custom project
        created = run_sync_coro(
            app_main.create_new_project(
                app_main.ProjectCreateRequest(
                    name="Project Attention",
                    description="Study of transformer architectures",
                )
            )
        )
        new_pid = created["id"]
        self.assertEqual(created["name"], "Project Attention")

        # 3. Add node to new project
        run_sync_coro(
            app_main.persist_node(
                app_main.NodeSaveRequest(
                    id="node-proj-attn",
                    type="note",
                    position={"x": 50, "y": 50},
                    data={"title": "Attention Mechanism Note"},
                    project_id=new_pid,
                )
            )
        )

        # 4. Add node to default project
        run_sync_coro(
            app_main.persist_node(
                app_main.NodeSaveRequest(
                    id="node-default",
                    type="note",
                    position={"x": 20, "y": 20},
                    data={"title": "Default Workspace Note"},
                    project_id="default",
                )
            )
        )

        # 5. Verify isolation: graph for new_pid only contains node-proj-attn
        graph_new = run_sync_coro(app_main.get_workspace_graph(project_id=new_pid))
        self.assertEqual(len(graph_new["nodes"]), 1)
        self.assertEqual(graph_new["nodes"][0]["id"], "node-proj-attn")

        graph_default = run_sync_coro(app_main.get_workspace_graph(project_id="default"))
        self.assertEqual(len(graph_default["nodes"]), 1)
        self.assertEqual(graph_default["nodes"][0]["id"], "node-default")

        # 6. Resetting new_pid does NOT touch default
        run_sync_coro(app_main.reset_workspace(project_id=new_pid))
        graph_new_after = run_sync_coro(app_main.get_workspace_graph(project_id=new_pid))
        self.assertEqual(len(graph_new_after["nodes"]), 0)

        graph_default_after = run_sync_coro(app_main.get_workspace_graph(project_id="default"))
        self.assertEqual(len(graph_default_after["nodes"]), 1)
        self.assertEqual(graph_default_after["nodes"][0]["id"], "node-default")

    def test_research_gap_analysis_and_indexing(self):
        # 1. Test analyze_research_gaps endpoint with mock Ollama response
        with patch.object(
            app_main.ollama,
            "chat",
            return_value={
                "message": {
                    "content": "1. Contradictions: Study A uses CPU-only evaluation while Study B targets TPU.\n2. Limitations: Dataset is synthetic and small (N=100)."
                }
            },
        ) as mock_gap_chat:
            resp = run_sync_coro(
                app_main.analyze_research_gaps(
                    app_main.ResearchGapRequest(
                        paper_ids=["gap-paper-1", "gap-paper-2"],
                        paper_contexts={
                            "gap-paper-1": "Title: Paper 1\nAbstract: CPU benchmark with small synthetic dataset.",
                            "gap-paper-2": "Title: Paper 2\nAbstract: TPU evaluation without baseline comparison.",
                        },
                    )
                )
            )
            self.assertIn("gaps_summary", resp)
            self.assertIn("Contradictions", resp["gaps_summary"])
            prompt_content = mock_gap_chat.call_args.kwargs["messages"][0]["content"]
            self.assertIn("scientific research gap analyst", prompt_content)

        # 2. Test gap node indexing into ChromaDB
        run_sync_coro(
            app_main.persist_node(
                app_main.NodeSaveRequest(
                    id="gap-100",
                    type="gap",
                    position={"x": 100, "y": 200},
                    data={
                        "title": "Research Gap Discovery",
                        "summary": "Key gap: Absence of multi-GPU evaluations in attention benchmarks.",
                    },
                )
            )
        )
        chunks = vector_store.query_paper_chunks("gap-100", "multi-GPU")
        self.assertTrue(len(chunks) > 0)
        self.assertIn("multi-GPU", chunks[0])

    def test_project_switching_and_node_isolation(self):
        """Verify that multiple projects maintain strict node and edge isolation."""
        # Create Project A
        proj_a = database.create_project("Project Alpha", "First test project")
        pid_a = proj_a["id"]
        # Create Project B
        proj_b = database.create_project("Project Beta", "Second test project")
        pid_b = proj_b["id"]

        # Save 4 different node types into Project A
        database.save_node("paper-a1", "uploadedPaper", 10.0, 20.0, {"title": "Paper A1", "summary": "Abstract A1"}, project_id=pid_a)
        database.save_node("synth-a1", "synth", 50.0, 60.0, {"title": "Synthesis Task", "taskMode": "gaps"}, project_id=pid_a)
        database.save_node("gap-a1", "gap", 100.0, 120.0, {"title": "Gap Node", "summary": "Identified gap"}, project_id=pid_a)
        database.save_node("exp-a1", "experiment", 150.0, 160.0, {"label": "Latency Run", "metric": "1.2ms", "status": "success"}, project_id=pid_a)
        database.save_edge("edge-a1", "paper-a1", "synth-a1", "cites", project_id=pid_a)

        # Verify Project A has 4 nodes and 1 edge
        graph_a = database.load_graph(pid_a)
        self.assertEqual(len(graph_a["nodes"]), 4)
        self.assertEqual(len(graph_a["edges"]), 1)
        node_types = {n["id"]: n["type"] for n in graph_a["nodes"]}
        self.assertEqual(node_types["paper-a1"], "uploadedPaper")
        self.assertEqual(node_types["synth-a1"], "synth")
        self.assertEqual(node_types["gap-a1"], "gap")
        self.assertEqual(node_types["exp-a1"], "experiment")

        # Verify Project B is completely empty
        graph_b = database.load_graph(pid_b)
        self.assertEqual(len(graph_b["nodes"]), 0)
        self.assertEqual(len(graph_b["edges"]), 0)

        # Add node to Project B
        database.save_node("paper-b1", "uploadedPaper", 0.0, 0.0, {"title": "Paper B1"}, project_id=pid_b)
        graph_b2 = database.load_graph(pid_b)
        self.assertEqual(len(graph_b2["nodes"]), 1)

        # Verify Project A was untouched
        graph_a2 = database.load_graph(pid_a)
        self.assertEqual(len(graph_a2["nodes"]), 4)

        # Cleanup
        database.delete_project(pid_a)
        database.delete_project(pid_b)

    def test_paper_agnostic_pipeline_and_sandbox_execution(self):
        """Verify that the reader and coder agents dynamically adapt to non-transformer domains."""
        from app.agents.pipeline import paper_reader_node, code_generator_node
        from app.sandbox.runner import execute_sandboxed_code

        state = {
            "paper_text": "Title: 2112.03570v2 Membership Inference Attacks From First Principles. We introduce LiRA (Likelihood Ratio Attack) which fits Gaussian distributions to shadow model confidence scores and outperforms LOSS-based thresholding at low FPR.",
            "user_goal": "Simulate LiRA likelihood ratio attack vs LOSS thresholding baseline",
            "hyperparameters": None,
            "generated_code": None,
            "eval_status": None,
        }

        # 1. Reader extracts non-transformer domain parameters
        reader_out = paper_reader_node(state)
        params = reader_out.get("hyperparameters", {})
        self.assertIsInstance(params, dict)
        self.assertTrue("attack_method" in params or "shadow_models" in params or "primary_algorithm" in params)
        # Should not force Transformer keys
        self.assertNotIn("d_model", params)

        # 2. Coder generates domain-accurate numpy script
        state["hyperparameters"] = params
        coder_out = code_generator_node(state)
        code = coder_out.get("generated_code", "")
        self.assertIn("time.perf_counter()", code)
        self.assertIn("METRIC_OPTIMIZED:", code)
        self.assertIn("METRIC_BASELINE:", code)
        self.assertNotIn("np.dot(", code)

        # 3. Sandbox executes without negative latency or crashes
        exec_out = execute_sandboxed_code(code)
        self.assertEqual(exec_out["status"], "success")
        self.assertTrue(exec_out["passed"])
        self.assertIn("latency", exec_out["metrics"])
        self.assertTrue(len(exec_out["metrics"]["summary"]) > 0)

        with patch.object(
            app_main.ollama,
            "chat",
            return_value={"message": {"content": "LiRA achieved 72.8% TPR at 0.1% FPR with 14.2x speedup."}},
        ) as mock_chat:
            resp = run_sync_coro(
                app_main.chat_with_paper(
                    app_main.ChatRequest(
                        paper_id="2112.03570v2",
                        query="Can you explain what this benchmark result means in plain English?",
                        fallback_context="Benchmark Result Summary: Simulated LiRA Gaussian parametric attack. TPR @ 0.1% FPR: 72.8% vs 67.6% with 14.2x speedup.",
                    )
                )
            )
            self.assertIn("72.8% TPR", resp["reply"])
            messages_sent = mock_chat.call_args.kwargs["messages"]
            prompt_sent = " ".join(m["content"] for m in messages_sent)
            self.assertIn("72.8% vs 67.6%", prompt_sent)
            self.assertEqual(mock_chat.call_args.kwargs["options"]["temperature"], 0.0)

    def test_lira_fallback_ensures_opt_tpr_greater_than_baseline_tpr(self):
        """Verify that LiRA simulation never outputs contradictory or identical TPR metrics."""
        from app.agents.pipeline import _build_dynamic_fallback_code
        from app.sandbox.runner import execute_sandboxed_code
        import re

        code = _build_dynamic_fallback_code(
            {"shadow_models": 16},
            "2112.03570v2 Membership Inference Attacks From First Principles LiRA",
            "Simulate LiRA Gaussian attack"
        )
        res = execute_sandboxed_code(code)
        self.assertEqual(res["status"], "success")
        self.assertTrue(res["passed"])

        primary = res["metrics"].get("primary_metric", "")
        self.assertIn("TPR @ 0.1% FPR:", primary)
        match = re.search(r"TPR @ 0\.1% FPR:\s*([\d\.]+)%\s*vs\s*([\d\.]+)%", primary)
        self.assertIsNotNone(match, f"Primary metric does not match expected format: {primary}")
        opt_tpr = float(match.group(1))
        base_tpr = float(match.group(2))
        # Must strictly outperform baseline and never be identical
        self.assertGreater(opt_tpr, base_tpr)
        self.assertNotEqual(opt_tpr, base_tpr)

    def test_evaluator_catches_name_error_and_nan_and_substitutes_fallback(self):
        """Verify that evaluator_node validates code and replaces broken scripts with runnable domain fallbacks."""
        from app.agents.pipeline import evaluator_node
        from app.sandbox.runner import execute_sandboxed_code, _parse_benchmark_metrics

        base_state = {
            "paper_text": "2112.03570v2 Membership Inference Attacks From First Principles with LiRA",
            "user_goal": "Simulate LiRA shadow model attack",
            "hyperparameters": {"attack_method": "LiRA", "shadow_models": 16},
            "eval_status": None,
        }

        # Case 1: Script with undefined variable (NameError: t_end is not defined)
        buggy_state_1 = dict(base_state)
        buggy_state_1["generated_code"] = (
            "import time\n"
            "import numpy as np\n"
            "t_start = time.perf_counter()\n"
            "latency = (t_end - t_start) * 1000\n"
            "print(f'METRIC_OPTIMIZED: {latency:.2f}ms')\n"
        )
        res_1 = evaluator_node(buggy_state_1)
        self.assertIn("generated_code", res_1)
        self.assertNotEqual(res_1["generated_code"], buggy_state_1["generated_code"])
        # Fallback code must run cleanly in sandbox
        exec_1 = execute_sandboxed_code(res_1["generated_code"])
        self.assertEqual(exec_1["status"], "success")
        self.assertTrue(exec_1["passed"])
        self.assertNotIn("nan", exec_1["stdout"].lower())

        # Case 2: Script with NaN in output
        buggy_state_2 = dict(base_state)
        buggy_state_2["generated_code"] = (
            "import time\n"
            "import numpy as np\n"
            "val = np.log(-1.0)\n"
            "print(f'METRIC_OPTIMIZED: {val}ms')\n"
            "print(f'SUMMARY: Value is {val}')\n"
        )
        res_2 = evaluator_node(buggy_state_2)
        self.assertNotEqual(res_2["generated_code"], buggy_state_2["generated_code"])
        exec_2 = execute_sandboxed_code(res_2["generated_code"])
        self.assertEqual(exec_2["status"], "success")
        self.assertTrue(exec_2["passed"])

        # Case 3: Script with syntax error
        buggy_state_3 = dict(base_state)
        buggy_state_3["generated_code"] = "def invalid_syntax(: return 42"
        res_3 = evaluator_node(buggy_state_3)
        self.assertNotEqual(res_3["generated_code"], buggy_state_3["generated_code"])
        exec_3 = execute_sandboxed_code(res_3["generated_code"])
        self.assertEqual(exec_3["status"], "success")

        # Case 4: Valid script passes through without substitution
        valid_state = dict(base_state)
        valid_code = (
            "import time\n"
            "import numpy as np\n"
            "t0 = time.perf_counter()\n"
            "t1 = time.perf_counter()\n"
            "ms = (t1 - t0) * 1000\n"
            "print(f'METRIC_PRIMARY: TPR @ 0.1% FPR: 14.8% vs 1.2%')\n"
            "print(f'METRIC_OPTIMIZED: {ms:.2f}ms')\n"
            "print(f'METRIC_BASELINE: {ms*2:.2f}ms')\n"
            "print(f'METRIC_SPEEDUP: 2.0x')\n"
            "print('SUMMARY: Valid benchmark')\n"
        )
        valid_state["generated_code"] = valid_code
        res_4 = evaluator_node(valid_state)
        self.assertEqual(res_4["generated_code"], valid_code)
        self.assertEqual(res_4["eval_status"], "ready_for_hitl")

        # Verify runner parses METRIC_PRIMARY
        parsed = _parse_benchmark_metrics(valid_code)
        exec_4 = execute_sandboxed_code(valid_code)
        self.assertEqual(exec_4["metrics"]["primary_metric"], "TPR @ 0.1% FPR: 14.8% vs 1.2%")

    def test_workspace_export_markdown_and_bibtex_and_citations(self):
        """Verify that workspace export produces comprehensive Markdown dossier, valid BibTeX, and citation excerpts."""
        import uuid
        from app import main as app_main
        from app.db import database

        pid = f"proj_test_export_{uuid.uuid4().hex[:6]}"
        database.create_project("Export Test Workspace", "Evaluating membership inference and synthesis", project_id=pid)

        # 1. Add sample paper node
        database.save_node(
            "paper-exp1",
            "uploadedPaper",
            10.0,
            20.0,
            {
                "title": "Membership Inference Attacks From First Principles",
                "authors": ["Nicholas Carlini", "Steve Chien", "Milad Nasr"],
                "year": "2022",
                "abstract": "We evaluate membership inference attacks and introduce LiRA.",
                "doi": "10.48550/arXiv.2112.03570",
                "landing_page_url": "https://arxiv.org/abs/2112.03570",
            },
            project_id=pid,
        )

        # 2. Add sample note
        database.save_node(
            "note-exp1",
            "note",
            50.0,
            60.0,
            {
                "title": "Threat Model Assumptions",
                "text": "Attacker has black-box access to target model probabilities.",
            },
            project_id=pid,
        )

        # 3. Add synthesis and experiment
        database.save_node(
            "synth-exp1",
            "synthesisResult",
            100.0,
            120.0,
            {
                "title": "LiRA vs Baseline Comparison",
                "comparison_summary": "LiRA achieves 72.8% TPR at 0.1% FPR compared to 8.4% for baseline thresholding.",
            },
            project_id=pid,
        )
        database.save_node(
            "exp-exp1",
            "experiment",
            150.0,
            180.0,
            {
                "label": "LiRA Gaussian Simulation",
                "status": "success",
                "primaryMetric": "TPR @ 0.1% FPR: 72.8% vs 8.4%",
                "optimized_ms": 1.29,
                "baseline_ms": 18.32,
                "speedup": "14.2x",
                "summary": "Simulated LiRA Gaussian parametric attack.",
                "code": "import time\nprint('Simulation passed')",
            },
            project_id=pid,
        )

        # Test Markdown Export
        res_md = run_sync_coro(app_main.export_workspace(project_id=pid, format="markdown"))
        self.assertEqual(res_md["status"], "success")
        self.assertEqual(res_md["format"], "markdown")
        md_text = res_md["content"]
        self.assertIn("# Research Dossier: Export Test Workspace", md_text)
        self.assertIn("Membership Inference Attacks From First Principles", md_text)
        self.assertIn("Nicholas Carlini, Steve Chien, Milad Nasr", md_text)
        self.assertIn("Threat Model Assumptions", md_text)
        self.assertIn("LiRA vs Baseline Comparison", md_text)
        self.assertIn("LiRA Gaussian Simulation", md_text)
        self.assertIn("TPR @ 0.1% FPR: 72.8% vs 8.4%", md_text)
        self.assertIn("```python", md_text)

        # Test BibTeX Export
        res_bib = run_sync_coro(app_main.export_workspace(project_id=pid, format="bibtex"))
        self.assertEqual(res_bib["status"], "success")
        self.assertEqual(res_bib["format"], "bibtex")
        bib_text = res_bib["content"]
        self.assertIn("@article{", bib_text)
        self.assertIn("title = {{Membership Inference Attacks From First Principles}}", bib_text)
        self.assertIn("author = {Nicholas Carlini and Steve Chien and Milad Nasr}", bib_text)
        self.assertIn("year = {2022}", bib_text)
        self.assertIn("doi = {10.48550/arXiv.2112.03570}", bib_text)

        # Test Citation Excerpt
        res_cit = run_sync_coro(app_main.get_citation_excerpt(paper_id="paper-exp1", page="1", project_id=pid))
        self.assertEqual(res_cit["status"], "success")
        self.assertIn("We evaluate membership inference", res_cit["excerpt"])

        # Cleanup
        database.delete_project(pid)


if __name__ == "__main__":
    unittest.main()
