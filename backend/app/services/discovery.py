import asyncio
import logging
import re
from typing import Dict, List, Optional
from app.schemas.discovery import DiscoveredPaper, DiscoverySearchResponse, DiscoveryDoiResponse
from app.services.openalex import OpenAlexClient, normalize_doi
from app.services.crossref import CrossrefClient
from app.services.unpaywall import UnpaywallClient

logger = logging.getLogger(__name__)


def normalize_title(title: str) -> str:
    cleaned = re.sub(r"[^\w\s]", "", title.lower())
    return " ".join(cleaned.split())


class DiscoveryService:
    def __init__(
        self,
        openalex: Optional[OpenAlexClient] = None,
        crossref: Optional[CrossrefClient] = None,
        unpaywall: Optional[UnpaywallClient] = None,
    ):
        self.openalex = openalex or OpenAlexClient()
        self.crossref = crossref or CrossrefClient()
        self.unpaywall = unpaywall or UnpaywallClient()

    def merge_paper_records(self, base: DiscoveredPaper, update: DiscoveredPaper) -> DiscoveredPaper:
        """Merge metadata from two records representing the same work."""
        for provider in update.providers:
            if provider not in base.providers:
                base.providers.append(provider)

        # Retain best title (longer/more descriptive)
        if (not base.title or base.title == "Untitled") and update.title:
            base.title = update.title

        # Retain authors if base has none
        if not base.authors and update.authors:
            base.authors = update.authors

        # Retain publication year
        if not base.year and update.year:
            base.year = update.year

        # Retain DOI
        if not base.doi and update.doi:
            base.doi = update.doi

        # Retain publication venue
        if not base.publication and update.publication:
            base.publication = update.publication

        # Retain abstract
        if (not base.abstract or len(base.abstract) < 30) and update.abstract:
            base.abstract = update.abstract

        # Retain OpenAlex ID
        if not base.openalex_id and update.openalex_id:
            base.openalex_id = update.openalex_id

        # Retain OA status and PDF links
        if not base.is_oa and update.is_oa:
            base.is_oa = True
            base.oa_status = update.oa_status or base.oa_status
            base.pdf_url = update.pdf_url or base.pdf_url

        if not base.pdf_url and update.pdf_url:
            base.pdf_url = update.pdf_url

        if not base.landing_page_url and update.landing_page_url:
            base.landing_page_url = update.landing_page_url

        return base

    async def search(
        self,
        query: str,
        provider: str = "all",
        limit: int = 15,
    ) -> DiscoverySearchResponse:
        cleaned_query = query.strip()
        if not cleaned_query:
            return DiscoverySearchResponse(
                query="",
                total_results=0,
                papers=[],
                provider=provider,
                warnings=["Empty search query provided."],
            )

        provider_lower = provider.lower()
        warnings: List[str] = []
        raw_papers: List[DiscoveredPaper] = []

        if provider_lower == "openalex":
            raw_papers = await self.openalex.search(cleaned_query, per_page=limit)
        elif provider_lower == "crossref":
            raw_papers = await self.crossref.search(cleaned_query, rows=limit)
        elif provider_lower == "all":
            # Primary search OpenAlex; if few results or fallback, also query Crossref
            openalex_task = self.openalex.search(cleaned_query, per_page=limit)
            crossref_task = self.crossref.search(cleaned_query, rows=min(limit, 10))
            results = await asyncio.gather(openalex_task, crossref_task, return_exceptions=True)

            openalex_results = results[0] if not isinstance(results[0], Exception) else []
            crossref_results = results[1] if not isinstance(results[1], Exception) else []

            if isinstance(results[0], Exception):
                warnings.append(f"OpenAlex query error: {results[0]}")
            if isinstance(results[1], Exception):
                warnings.append(f"Crossref query error: {results[1]}")

            raw_papers.extend(openalex_results)
            raw_papers.extend(crossref_results)
        else:
            warnings.append(f"Unknown provider '{provider}', falling back to OpenAlex.")
            raw_papers = await self.openalex.search(cleaned_query, per_page=limit)

        # Deduplicate papers based on DOI, OpenAlex ID, and normalized title
        seen_doi: Dict[str, DiscoveredPaper] = {}
        seen_title: Dict[str, DiscoveredPaper] = {}
        unique_papers: List[DiscoveredPaper] = []

        for p in raw_papers:
            doi_key = p.doi.lower() if p.doi else None
            title_key = normalize_title(p.title) if p.title else ""

            matched: Optional[DiscoveredPaper] = None
            if doi_key and doi_key in seen_doi:
                matched = seen_doi[doi_key]
            elif title_key and len(title_key) > 8 and title_key in seen_title:
                matched = seen_title[title_key]

            if matched:
                self.merge_paper_records(matched, p)
            else:
                unique_papers.append(p)
                if doi_key:
                    seen_doi[doi_key] = p
                if title_key:
                    seen_title[title_key] = p

        # Enrich top papers lacking PDF URL with Unpaywall if DOI exists
        enrichment_candidates = [
            p for p in unique_papers[:limit]
            if p.doi and (not p.pdf_url or not p.is_oa)
        ]
        if enrichment_candidates and self.unpaywall.email:
            async def enrich(p: DiscoveredPaper):
                try:
                    oa_info = await self.unpaywall.get_oa_info(p.doi) # type: ignore
                    if oa_info:
                        if oa_info.get("is_oa"):
                            p.is_oa = True
                            p.oa_status = oa_info.get("oa_status") or p.oa_status
                        if oa_info.get("pdf_url") and not p.pdf_url:
                            p.pdf_url = oa_info["pdf_url"]
                        if oa_info.get("landing_page_url") and not p.landing_page_url:
                            p.landing_page_url = oa_info["landing_page_url"]
                        if "unpaywall" not in p.providers:
                            p.providers.append("unpaywall")
                except Exception as e:
                    logger.debug(f"Unpaywall enrichment skipped for {p.doi}: {e}")

            await asyncio.gather(*[enrich(p) for p in enrichment_candidates[:5]], return_exceptions=True)

        final_papers = unique_papers[:limit]
        return DiscoverySearchResponse(
            query=cleaned_query,
            total_results=len(final_papers),
            papers=final_papers,
            provider=provider,
            warnings=warnings,
        )

    async def get_by_doi(self, doi: str) -> DiscoveryDoiResponse:
        clean_doi = normalize_doi(doi)
        if not clean_doi:
            return DiscoveryDoiResponse(
                doi=doi,
                found=False,
                paper=None,
                warnings=["Invalid or unparseable DOI provided."],
            )

        warnings: List[str] = []

        # Query OpenAlex, Crossref, and Unpaywall concurrently
        oa_task = self.openalex.get_by_doi(clean_doi)
        cr_task = self.crossref.get_by_doi(clean_doi)
        up_task = self.unpaywall.get_oa_info(clean_doi)

        results = await asyncio.gather(oa_task, cr_task, up_task, return_exceptions=True)

        openalex_paper = results[0] if isinstance(results[0], DiscoveredPaper) else None
        crossref_paper = results[1] if isinstance(results[1], DiscoveredPaper) else None
        unpaywall_data = results[2] if isinstance(results[2], dict) else None

        if isinstance(results[0], Exception):
            warnings.append(f"OpenAlex lookup error: {results[0]}")
        if isinstance(results[1], Exception):
            warnings.append(f"Crossref lookup error: {results[1]}")

        target_paper: Optional[DiscoveredPaper] = None

        if openalex_paper and crossref_paper:
            target_paper = self.merge_paper_records(openalex_paper, crossref_paper)
        elif openalex_paper:
            target_paper = openalex_paper
        elif crossref_paper:
            target_paper = crossref_paper

        if target_paper and unpaywall_data:
            if unpaywall_data.get("is_oa"):
                target_paper.is_oa = True
                target_paper.oa_status = unpaywall_data.get("oa_status") or target_paper.oa_status
            if unpaywall_data.get("pdf_url") and not target_paper.pdf_url:
                target_paper.pdf_url = unpaywall_data["pdf_url"]
            if unpaywall_data.get("landing_page_url") and not target_paper.landing_page_url:
                target_paper.landing_page_url = unpaywall_data["landing_page_url"]
            if "unpaywall" not in target_paper.providers:
                target_paper.providers.append("unpaywall")

        if not target_paper:
            return DiscoveryDoiResponse(
                doi=clean_doi,
                found=False,
                paper=None,
                warnings=warnings or ["No records found across configured academic providers."],
            )

        return DiscoveryDoiResponse(
            doi=clean_doi,
            found=True,
            paper=target_paper,
            warnings=warnings,
        )


discovery_service = DiscoveryService()
