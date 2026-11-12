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
        if where and "paper_id" in where:
            target = where["paper_id"]
            to_remove = [
                doc_id
                for doc_id, rec in self.records.items()
                if rec["metadata"].get("paper_id") == target
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
            prompt_sent = mock_chat.call_args.kwargs["messages"][0]["content"]
            self.assertIn("8 attention heads", prompt_sent)

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
            full_prompt = mock_chat_full.call_args.kwargs["messages"][0]["content"]
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


if __name__ == "__main__":
    unittest.main()
