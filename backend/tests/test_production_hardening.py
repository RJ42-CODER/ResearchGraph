import io
import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings, Settings


class TestProductionHardening(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_endpoint(self):
        """GET /health must return 200 with healthy status without invoking LLM."""
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("status"), "healthy")
        self.assertIn("environment", data)
        self.assertIn("timestamp", data)

    def test_capabilities_endpoint(self):
        """GET /api/capabilities must report reachability for all core services."""
        res = self.client.get("/api/capabilities")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("status"), "operational")
        caps = data.get("capabilities", {})

        # 1. Discovery
        self.assertIn("discovery", caps)
        self.assertTrue(caps["discovery"]["available"])
        self.assertIn("openalex", caps["discovery"]["providers"])

        # 2. Persistence
        self.assertIn("persistence", caps)
        self.assertTrue(caps["persistence"]["available"])

        # 3. PDF Processing
        self.assertIn("pdf_processing", caps)
        self.assertTrue(caps["pdf_processing"]["available"])

        # 4. Ollama Inference
        self.assertIn("ollama_inference", caps)
        self.assertIn("available", caps["ollama_inference"])
        self.assertIn("base_url", caps["ollama_inference"])

        # 5. Embeddings
        self.assertIn("embeddings", caps)
        self.assertIn("available", caps["embeddings"])

        # 6. Experiment Generation
        self.assertIn("experiment_generation", caps)
        self.assertTrue(caps["experiment_generation"]["available"])

        # 7. Experiment Execution
        self.assertIn("experiment_execution", caps)
        self.assertIn("enabled", caps["experiment_execution"])

    def test_cors_configuration_production_vs_development(self):
        """CORS must not default to wildcard in production and must parse configured origins."""
        s = Settings()
        s.APP_ENV = "production"
        s.CORS_ORIGINS = ""
        self.assertEqual(s.get_cors_origins(), [])

        s.CORS_ORIGINS = "https://researchgraph.vercel.app, https://custom.domain.org"
        self.assertEqual(
            s.get_cors_origins(),
            ["https://researchgraph.vercel.app", "https://custom.domain.org"],
        )

        s.APP_ENV = "development"
        s.CORS_ORIGINS = ""
        self.assertIn("http://localhost:3000", s.get_cors_origins())

    def test_sandbox_execution_disabled_guard(self):
        """When ENABLE_SANDBOX_EXECUTION is False, execute endpoint must return 403."""
        with patch.object(settings, "ENABLE_SANDBOX_EXECUTION", False):
            res = self.client.post("/api/sandbox/execute", json={"code": "print('hello')"})
            self.assertEqual(res.status_code, 403)
            self.assertIn("disabled", res.json().get("detail", "").lower())

    def test_sandbox_execution_enabled(self):
        """When ENABLE_SANDBOX_EXECUTION is True, safe code executes successfully."""
        with patch.object(settings, "ENABLE_SANDBOX_EXECUTION", True):
            res = self.client.post(
                "/api/sandbox/execute",
                json={"code": "print('METRIC_PRIMARY: Value 100')\nprint('SUMMARY: OK')"},
            )
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data.get("status"), "success")

    def test_upload_non_pdf_rejected(self):
        """Uploading non-PDF files must be rejected with 400 Bad Request."""
        file_content = b"Plain text file content"
        res = self.client.post(
            "/api/papers/upload",
            files={"file": ("notes.txt", io.BytesIO(file_content), "text/plain")},
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Only PDF files", res.json().get("detail", ""))

    def test_upload_invalid_pdf_header_rejected(self):
        """Uploading a file named .pdf without valid %PDF magic bytes must be rejected with 400."""
        file_content = b"NOT_A_PDF_HEADER but named pdf"
        res = self.client.post(
            "/api/papers/upload",
            files={"file": ("fake.pdf", io.BytesIO(file_content), "application/pdf")},
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("missing '%PDF' header signature", res.json().get("detail", ""))

    def test_upload_size_limit_enforced(self):
        """Files exceeding MAX_UPLOAD_MB must return 413 Payload Too Large."""
        # Mock MAX_UPLOAD_MB to 1MB and attempt uploading 1.5MB
        with patch.object(settings, "MAX_UPLOAD_MB", 1):
            large_content = b"%PDF-1.5 " + b"X" * (1024 * 1024 + 100)
            res = self.client.post(
                "/api/papers/upload",
                files={"file": ("large.pdf", io.BytesIO(large_content), "application/pdf")},
            )
            self.assertEqual(res.status_code, 413)
            self.assertIn("maximum allowed upload size", res.json().get("detail", ""))

    def test_upload_valid_pdf_accepted(self):
        """Valid PDF with header is accepted and queued for background indexing."""
        valid_pdf = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
        res = self.client.post(
            "/api/papers/upload",
            files={"file": ("valid.pdf", io.BytesIO(valid_pdf), "application/pdf")},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("status"), "indexing_started")
        self.assertIn("paper_id", data)

    def test_ollama_unreachable_error_handling(self):
        """When Ollama service is unreachable, endpoints return 503 instead of crashing."""
        with patch("ollama.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.chat.side_effect = Exception("Connection refused to Ollama")
            mock_client_cls.return_value = mock_client

            # Test chat endpoint with fallback context provided
            res = self.client.post(
                "/api/agents/chat",
                json={
                    "paper_id": "p1",
                    "query": "Summarize this",
                    "fallback_context": "Paper Title: Sample Paper\nAbstract: Exploration of deep architectures.",
                },
            )
            self.assertEqual(res.status_code, 503)
            self.assertIn("unavailable", res.json().get("detail", "").lower())

            # Test cross-reference endpoint
            res = self.client.post(
                "/api/agents/cross-reference",
                json={
                    "paper_ids": ["p1", "p2"],
                    "paper_contexts": {
                        "p1": "Paper 1: Attention mechanisms",
                        "p2": "Paper 2: Convolutional layers",
                    },
                },
            )
            self.assertEqual(res.status_code, 503)
            self.assertIn("unavailable", res.json().get("detail", "").lower())

            # Test research-gap endpoint
            res = self.client.post(
                "/api/agents/research-gap",
                json={
                    "paper_ids": ["p1", "p2"],
                    "paper_contexts": {
                        "p1": "Paper 1: Attention mechanisms",
                        "p2": "Paper 2: Convolutional layers",
                    },
                },
            )
            self.assertEqual(res.status_code, 503)
            self.assertIn("unavailable", res.json().get("detail", "").lower())


if __name__ == "__main__":
    unittest.main()
