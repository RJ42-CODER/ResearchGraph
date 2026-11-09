import asyncio
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.openalex import (
    normalize_doi,
    reconstruct_abstract,
    parse_openalex_work,
    OpenAlexClient,
)
from app.services.crossref import (
    strip_jats_tags,
    parse_crossref_item,
    CrossrefClient,
)
from app.services.unpaywall import UnpaywallClient
from app.services.discovery import DiscoveryService, normalize_title
from app.schemas.discovery import DiscoveredPaper, DiscoverySearchResponse, DiscoveryDoiResponse
from fastapi.testclient import TestClient
from app.main import app


# ---------------------------------------------------------
# 1. Normalization & Utility Tests
# ---------------------------------------------------------

def test_normalize_doi():
    assert normalize_doi("https://doi.org/10.1038/s41586-020-2649-2") == "10.1038/s41586-020-2649-2"
    assert normalize_doi("http://dx.doi.org/10.1145/3377325.3377498") == "10.1145/3377325.3377498"
    assert normalize_doi("doi:10.1016/j.cell.2020.08.034") == "10.1016/j.cell.2020.08.034"
    assert normalize_doi("  10.1000/182  ") == "10.1000/182"
    assert normalize_doi(None) is None
    assert normalize_doi("") is None


def test_reconstruct_abstract():
    inverted_index = {
        "Attention": [0],
        "is": [1],
        "all": [2],
        "you": [3],
        "need": [4],
        ".": [5],
    }
    reconstructed = reconstruct_abstract(inverted_index)
    assert reconstructed == "Attention is all you need ."
    assert reconstruct_abstract(None) is None
    assert reconstruct_abstract({}) is None


def test_strip_jats_tags():
    xml_text = "<jats:title>Abstract</jats:title><jats:p>This study demonstrates <jats:bold>promising</jats:bold> results.</jats:p>"
    stripped = strip_jats_tags(xml_text)
    assert stripped == "AbstractThis study demonstrates promising results."
    assert strip_jats_tags(None) is None


def test_normalize_title():
    t1 = "Attention Is All You Need!"
    t2 = "attention is all you need"
    assert normalize_title(t1) == normalize_title(t2)


# ---------------------------------------------------------
# 2. OpenAlex Parser & Keyless Client Tests
# ---------------------------------------------------------

def test_parse_openalex_work():
    mock_work = {
        "id": "https://openalex.org/W2741809807",
        "doi": "https://doi.org/10.48550/arxiv.1706.03762",
        "title": "Attention Is All You Need",
        "publication_year": 2017,
        "primary_location": {
            "source": {"display_name": "Advances in Neural Information Processing Systems"},
            "pdf_url": "https://arxiv.org/pdf/1706.03762.pdf",
            "landing_page_url": "https://arxiv.org/abs/1706.03762",
        },
        "authorships": [
            {"author": {"display_name": "Ashish Vaswani"}},
            {"author": {"display_name": "Noam Shazeer"}},
        ],
        "abstract_inverted_index": {
            "We": [0],
            "propose": [1],
            "the": [2],
            "Transformer": [3],
        },
        "open_access": {
            "is_oa": True,
            "oa_status": "green",
            "oa_url": "https://arxiv.org/pdf/1706.03762.pdf",
        },
    }

    paper = parse_openalex_work(mock_work)
    assert paper.title == "Attention Is All You Need"
    assert paper.doi == "10.48550/arxiv.1706.03762"
    assert paper.year == 2017
    assert paper.authors == ["Ashish Vaswani", "Noam Shazeer"]
    assert paper.publication == "Advances in Neural Information Processing Systems"
    assert paper.abstract == "We propose the Transformer"
    assert paper.is_oa is True
    assert paper.oa_status == "green"
    assert paper.pdf_url == "https://arxiv.org/pdf/1706.03762.pdf"
    assert paper.primary_provider == "openalex"
    assert "openalex" in paper.providers


def test_openalex_client_keyless():
    client = OpenAlexClient(api_key=None)
    headers = client._get_headers()
    assert "api_key" not in headers
    assert "User-Agent" in headers


# ---------------------------------------------------------
# 3. Crossref Parser Tests
# ---------------------------------------------------------

def test_parse_crossref_item():
    mock_item = {
        "DOI": "10.1038/nature12373",
        "title": ["A global reference for human genetic variation"],
        "author": [
            {"given": "David", "family": "Altshuler"},
            {"name": "1000 Genomes Project Consortium"},
        ],
        "issued": {"date-parts": [[2015, 10, 1]]},
        "container-title": ["Nature"],
        "abstract": "<jats:p>The 1000 Genomes Project discovered 88 million variants.</jats:p>",
        "URL": "http://dx.doi.org/10.1038/nature12373",
        "link": [
            {"content-type": "application/pdf", "URL": "https://www.nature.com/articles/nature12373.pdf"}
        ],
        "license": [
            {"URL": "http://creativecommons.org/licenses/by/4.0/"}
        ]
    }

    paper = parse_crossref_item(mock_item)
    assert paper.title == "A global reference for human genetic variation"
    assert paper.doi == "10.1038/nature12373"
    assert paper.year == 2015
    assert paper.authors == ["David Altshuler", "1000 Genomes Project Consortium"]
    assert paper.publication == "Nature"
    assert paper.abstract == "The 1000 Genomes Project discovered 88 million variants."
    assert paper.is_oa is True
    assert paper.pdf_url == "https://www.nature.com/articles/nature12373.pdf"
    assert paper.primary_provider == "crossref"


# ---------------------------------------------------------
# 4. Unpaywall Missing Credentials & Retirement Safety
# ---------------------------------------------------------

def test_unpaywall_missing_email_graceful():
    async def run():
        client = UnpaywallClient(email=None)
        # Should not throw; returns None gracefully
        result = await client.get_oa_info("10.1038/nature12373")
        assert result is None
    asyncio.run(run())


# ---------------------------------------------------------
# 5. Deduplication and Metadata Merging Tests
# ---------------------------------------------------------

def test_discovery_service_deduplication():
    async def run():
        paper_from_openalex = DiscoveredPaper(
            id="10.1038/s41586-020-2649-2",
            title="Language Models are Few-Shot Learners",
            authors=["Tom Brown", "Benjamin Mann"],
            year=2020,
            doi="10.1038/s41586-020-2649-2",
            publication="NeurIPS",
            abstract=None,
            openalex_id="https://openalex.org/W3032170045",
            is_oa=False,
            primary_provider="openalex",
            providers=["openalex"],
        )

        paper_from_crossref = DiscoveredPaper(
            id="10.1038/s41586-020-2649-2",
            title="Language Models are Few-Shot Learners",
            authors=["Tom Brown"],
            year=2020,
            doi="10.1038/s41586-020-2649-2",
            publication="Advances in Neural Information Processing Systems",
            abstract="Recent work has demonstrated substantial gains on many NLP tasks.",
            is_oa=True,
            oa_status="gold",
            pdf_url="https://arxiv.org/pdf/2005.14165.pdf",
            primary_provider="crossref",
            providers=["crossref"],
        )

        mock_openalex = MagicMock()
        mock_openalex.search = AsyncMock(return_value=[paper_from_openalex])

        mock_crossref = MagicMock()
        mock_crossref.search = AsyncMock(return_value=[paper_from_crossref])

        mock_unpaywall = MagicMock()
        mock_unpaywall.email = None

        service = DiscoveryService(openalex=mock_openalex, crossref=mock_crossref, unpaywall=mock_unpaywall)
        res = await service.search(query="few-shot learners", provider="all")

        assert res.total_results == 1
        merged = res.papers[0]
        assert merged.doi == "10.1038/s41586-020-2649-2"
        assert merged.abstract == "Recent work has demonstrated substantial gains on many NLP tasks."
        assert merged.is_oa is True
        assert merged.pdf_url == "https://arxiv.org/pdf/2005.14165.pdf"
        assert "openalex" in merged.providers
        assert "crossref" in merged.providers

    asyncio.run(run())


# ---------------------------------------------------------
# 6. ChromaDB Non-Contamination Test
# ---------------------------------------------------------

def test_vector_store_non_contamination():
    from app.db.vector_store import query_paper_chunks
    
    fake_paper_id = "non_existent_paper_id_999999"
    results = query_paper_chunks(paper_id=fake_paper_id, query="attention heads")
    assert results == []


# ---------------------------------------------------------
# 7. FastAPI Endpoint Tests
# ---------------------------------------------------------

def test_api_discovery_search():
    client = TestClient(app)
    mock_response = DiscoverySearchResponse(
        query="transformer",
        total_results=1,
        papers=[
            DiscoveredPaper(
                id="10.1000/1",
                title="Transformer Attention",
                authors=["Author One"],
                year=2021,
                doi="10.1000/1",
                publication="Journal",
                abstract="Summary text",
                openalex_id=None,
                is_oa=True,
                oa_status="gold",
                pdf_url="https://example.com/pdf.pdf",
                landing_page_url="https://example.com",
                primary_provider="openalex",
                providers=["openalex"],
            )
        ],
        provider="all",
        warnings=[],
    )

    with patch("app.services.discovery.discovery_service.search", new_callable=AsyncMock) as mock_search:
        mock_search.return_value = mock_response

        response = client.get("/api/discovery/search?q=transformer")
        assert response.status_code == 200
        data = response.json()
        assert data["total_results"] == 1
        assert data["papers"][0]["title"] == "Transformer Attention"
        assert data["papers"][0]["is_oa"] is True


def test_api_discovery_doi_lookup():
    client = TestClient(app)
    mock_response = DiscoveryDoiResponse(
        doi="10.1038/nature12373",
        found=True,
        paper=DiscoveredPaper(
            id="10.1038/nature12373",
            title="A global reference",
            authors=["Author A"],
            year=2015,
            doi="10.1038/nature12373",
            publication="Nature",
            abstract="Abstract",
            openalex_id=None,
            is_oa=True,
            oa_status="gold",
            pdf_url=None,
            landing_page_url="https://doi.org/10.1038/nature12373",
            primary_provider="crossref",
            providers=["crossref"],
        ),
        warnings=[],
    )

    with patch("app.services.discovery.discovery_service.get_by_doi", new_callable=AsyncMock) as mock_doi:
        mock_doi.return_value = mock_response

        response = client.get("/api/discovery/doi/10.1038/nature12373")
        assert response.status_code == 200
        data = response.json()
        assert data["found"] is True
        assert data["paper"]["title"] == "A global reference"


# ---------------------------------------------------------
# 8. Resilience, Rate Limits & Error Handling Tests
# ---------------------------------------------------------

def test_openalex_failed_request_handled():
    async def run():
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.side_effect = Exception("Network connection timeout")
            client = OpenAlexClient()
            results = await client.search("quantum computing")
            assert results == []
    asyncio.run(run())


def test_crossref_rate_limit_handled():
    async def run():
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_response = MagicMock()
            mock_response.status_code = 429
            mock_get.return_value = mock_response
            client = CrossrefClient()
            results = await client.search("deep learning")
            assert results == []
    asyncio.run(run())


def test_invalid_doi_lookup():
    async def run():
        service = DiscoveryService()
        res = await service.get_by_doi("")
        assert res.found is False
        assert "Invalid" in res.warnings[0]
    asyncio.run(run())
