import logging
import re
import urllib.parse
from typing import Any, Dict, List, Optional
import httpx
from app.core.config import settings
from app.schemas.discovery import DiscoveredPaper
from app.services.openalex import normalize_doi

logger = logging.getLogger(__name__)


def strip_jats_tags(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    # Strip XML/HTML tags often found in Crossref abstracts like <jats:p>
    cleaned = re.sub(r"<[^>]+>", "", text).strip()
    return cleaned if cleaned else None


def parse_crossref_item(item: Dict[str, Any]) -> DiscoveredPaper:
    raw_doi = item.get("DOI")
    clean_doi = normalize_doi(raw_doi)

    # Title extraction
    title_list = item.get("title") or []
    title = title_list[0] if isinstance(title_list, list) and len(title_list) > 0 else (item.get("title") or "Untitled")
    if isinstance(title, str):
        title = title.strip()

    # Author extraction
    authors: List[str] = []
    for a in item.get("author") or []:
        given = a.get("given", "").strip()
        family = a.get("family", "").strip()
        if given and family:
            authors.append(f"{given} {family}")
        elif family:
            authors.append(family)
        elif given:
            authors.append(given)
        elif a.get("name"):
            authors.append(a.get("name").strip())

    # Publication Year
    year = None
    date_parts = (
        item.get("published", {}).get("date-parts")
        or item.get("issued", {}).get("date-parts")
        or item.get("created", {}).get("date-parts")
    )
    if date_parts and isinstance(date_parts, list) and len(date_parts) > 0 and len(date_parts[0]) > 0:
        try:
            year = int(date_parts[0][0])
        except (ValueError, TypeError):
            pass

    # Publication venue
    container = item.get("container-title")
    publication = None
    if isinstance(container, list) and len(container) > 0:
        publication = container[0]
    elif isinstance(container, str):
        publication = container
    elif item.get("publisher"):
        publication = item.get("publisher")

    # Abstract
    abstract = strip_jats_tags(item.get("abstract"))

    # URLs
    landing_page_url = item.get("URL") or (f"https://doi.org/{clean_doi}" if clean_doi else None)
    pdf_url = None
    for link in item.get("link") or []:
        if link.get("content-type") == "application/pdf" and link.get("URL"):
            pdf_url = link.get("URL")
            break

    # Open access checks from license
    is_oa = False
    for license_item in item.get("license") or []:
        url_lic = license_item.get("URL", "").lower()
        if "creativecommons" in url_lic or "open-access" in url_lic or "public-domain" in url_lic:
            is_oa = True
            break

    paper_id = clean_doi or f"crossref-{hash(title)}"

    return DiscoveredPaper(
        id=paper_id,
        title=title,
        authors=authors,
        year=year,
        doi=clean_doi,
        publication=publication,
        abstract=abstract,
        openalex_id=None,
        is_oa=is_oa,
        oa_status="gold" if is_oa else None,
        pdf_url=pdf_url,
        landing_page_url=landing_page_url,
        primary_provider="crossref",
        providers=["crossref"],
    )


class CrossrefClient:
    def __init__(self, base_url: Optional[str] = None, mailto: Any = ...):
        self.base_url = (base_url or settings.CROSSREF_API_URL).rstrip("/")
        self.mailto = settings.CROSSREF_MAILTO if mailto is ... else mailto

    def _get_headers(self) -> Dict[str, str]:
        user_agent = "ResearchGraph/1.0"
        if self.mailto:
            user_agent += f" (mailto:{self.mailto})"
        return {"User-Agent": user_agent}

    async def search(self, query: str, rows: int = 15) -> List[DiscoveredPaper]:
        params: Dict[str, Any] = {
            "query": query.strip(),
            "rows": min(max(1, rows), 50),
        }
        if self.mailto:
            params["mailto"] = self.mailto

        url = f"{self.base_url}/works"
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.get(url, params=params, headers=self._get_headers())
                if response.status_code == 429:
                    logger.warning("Crossref rate limit hit (429)")
                    return []
                response.raise_for_status()
                data = response.json()
                items = data.get("message", {}).get("items") or []
                return [parse_crossref_item(item) for item in items if isinstance(item, dict)]
            except httpx.HTTPStatusError as e:
                logger.error(f"Crossref HTTP error: {e.response.status_code}")
                return []
            except httpx.RequestError as e:
                logger.error(f"Crossref connection error: {e}")
                return []
            except Exception as e:
                logger.error(f"Unexpected Crossref error: {e}")
                return []

    async def get_by_doi(self, doi: str) -> Optional[DiscoveredPaper]:
        clean_doi = normalize_doi(doi)
        if not clean_doi:
            return None

        encoded_doi = urllib.parse.quote(clean_doi, safe="")
        url = f"{self.base_url}/works/{encoded_doi}"
        params: Dict[str, Any] = {}
        if self.mailto:
            params["mailto"] = self.mailto

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.get(url, params=params, headers=self._get_headers())
                if response.status_code == 404:
                    return None
                if response.status_code == 429:
                    logger.warning("Crossref rate limit hit (429)")
                    return None
                response.raise_for_status()
                data = response.json()
                item = data.get("message") or {}
                return parse_crossref_item(item)
            except Exception as e:
                logger.error(f"Crossref get_by_doi error: {e}")
                return None
