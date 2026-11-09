import logging
import re
from typing import Any, Dict, List, Optional
import httpx
from app.core.config import settings
from app.schemas.discovery import DiscoveredPaper

logger = logging.getLogger(__name__)


def normalize_doi(doi: Optional[str]) -> Optional[str]:
    if not doi:
        return None
    cleaned = doi.strip()
    cleaned = re.sub(r"^https?://(dx\.)?doi\.org/", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^doi:", "", cleaned, flags=re.IGNORECASE).strip()
    return cleaned if cleaned else None


def reconstruct_abstract(inverted_index: Optional[Dict[str, List[int]]]) -> Optional[str]:
    if not inverted_index or not isinstance(inverted_index, dict):
        return None
    try:
        word_positions: List[tuple[int, str]] = []
        for word, positions in inverted_index.items():
            for pos in positions:
                word_positions.append((pos, word))
        word_positions.sort(key=lambda x: x[0])
        return " ".join(word for _, word in word_positions)
    except Exception as e:
        logger.debug(f"Failed to reconstruct abstract: {e}")
        return None


def parse_openalex_work(work: Dict[str, Any]) -> DiscoveredPaper:
    raw_doi = work.get("doi")
    clean_doi = normalize_doi(raw_doi)
    
    title = work.get("title") or work.get("display_name") or "Untitled"
    if isinstance(title, str):
        title = title.strip()
    
    # Extract authors
    authors: List[str] = []
    for authorship in work.get("authorships") or []:
        author = authorship.get("author") or {}
        name = author.get("display_name")
        if name:
            authors.append(name.strip())
            
    # Extract year
    year = work.get("publication_year")
    
    # Extract publication venue
    publication = None
    primary_location = work.get("primary_location") or {}
    source = primary_location.get("source") or {}
    if source.get("display_name"):
        publication = source.get("display_name")
    elif work.get("host_venue", {}).get("display_name"):
        publication = work.get("host_venue", {}).get("display_name")
        
    # Abstract
    abstract = reconstruct_abstract(work.get("abstract_inverted_index"))
    
    # Open Access details
    open_access = work.get("open_access") or {}
    is_oa = bool(open_access.get("is_oa", False))
    oa_status = open_access.get("oa_status")
    
    # URLs
    pdf_url = open_access.get("oa_url") or primary_location.get("pdf_url")
    landing_page_url = primary_location.get("landing_page_url") or (f"https://doi.org/{clean_doi}" if clean_doi else None)
    
    openalex_id = work.get("id")
    paper_id = clean_doi or (openalex_id.split("/")[-1] if openalex_id else f"openalex-{hash(title)}")
    
    return DiscoveredPaper(
        id=paper_id,
        title=title,
        authors=authors,
        year=year,
        doi=clean_doi,
        publication=publication,
        abstract=abstract,
        openalex_id=openalex_id,
        is_oa=is_oa,
        oa_status=oa_status,
        pdf_url=pdf_url,
        landing_page_url=landing_page_url,
        primary_provider="openalex",
        providers=["openalex"],
    )


class OpenAlexClient:
    def __init__(self, base_url: Optional[str] = None, api_key: Any = ...):
        self.base_url = (base_url or settings.OPENALEX_API_URL).rstrip("/")
        self.api_key = settings.OPENALEX_API_KEY if api_key is ... else api_key

    def _get_headers(self) -> Dict[str, str]:
        headers = {"User-Agent": "ResearchGraph/1.0 (Academic Discovery)"}
        if self.api_key:
            headers["api_key"] = self.api_key
        return headers

    async def search(self, query: str, per_page: int = 15) -> List[DiscoveredPaper]:
        params: Dict[str, Any] = {
            "search": query.strip(),
            "per_page": min(max(1, per_page), 50),
            "select": "id,doi,title,display_name,publication_year,primary_location,authorships,abstract_inverted_index,open_access",
        }
        if self.api_key:
            params["api_key"] = self.api_key

        url = f"{self.base_url}/works"
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.get(url, params=params, headers=self._get_headers())
                if response.status_code == 429:
                    logger.warning("OpenAlex rate limit exceeded (429)")
                    return []
                response.raise_for_status()
                data = response.json()
                results = data.get("results") or []
                return [parse_openalex_work(w) for w in results if isinstance(w, dict)]
            except httpx.HTTPStatusError as e:
                logger.error(f"OpenAlex HTTP error: {e.response.status_code}")
                return []
            except httpx.RequestError as e:
                logger.error(f"OpenAlex request connection error: {e}")
                return []
            except Exception as e:
                logger.error(f"Unexpected OpenAlex error: {e}")
                return []

    async def get_by_doi(self, doi: str) -> Optional[DiscoveredPaper]:
        clean_doi = normalize_doi(doi)
        if not clean_doi:
            return None

        url = f"{self.base_url}/works/https://doi.org/{clean_doi}"
        params: Dict[str, Any] = {
            "select": "id,doi,title,display_name,publication_year,primary_location,authorships,abstract_inverted_index,open_access",
        }
        if self.api_key:
            params["api_key"] = self.api_key

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.get(url, params=params, headers=self._get_headers())
                if response.status_code == 404:
                    return None
                if response.status_code == 429:
                    logger.warning("OpenAlex rate limit exceeded (429)")
                    return None
                response.raise_for_status()
                data = response.json()
                return parse_openalex_work(data)
            except Exception as e:
                logger.error(f"OpenAlex get_by_doi error: {e}")
                return None
