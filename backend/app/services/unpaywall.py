import logging
import urllib.parse
from typing import Any, Dict, Optional
import httpx
from app.core.config import settings
from app.services.openalex import normalize_doi

logger = logging.getLogger(__name__)


class UnpaywallClient:
    def __init__(self, base_url: Optional[str] = None, email: Any = ...):
        self.base_url = (base_url or settings.UNPAYWALL_API_URL).rstrip("/")
        self.email = settings.UNPAYWALL_EMAIL if email is ... else email

    async def get_oa_info(self, doi: str) -> Optional[Dict[str, Any]]:
        clean_doi = normalize_doi(doi)
        if not clean_doi:
            return None

        if not self.email:
            logger.info("UNPAYWALL_EMAIL not configured; skipping Unpaywall resolution.")
            return None

        # Note: Unpaywall /v2/search was retired on 18 September 2026.
        # We strictly use the single DOI lookup endpoint: /v2/{doi}?email={email}
        encoded_doi = urllib.parse.quote(clean_doi, safe="")
        url = f"{self.base_url}/v2/{encoded_doi}"
        params = {"email": self.email}

        async with httpx.AsyncClient(timeout=8.0) as client:
            try:
                response = await client.get(url, params=params, headers={"User-Agent": "ResearchGraph/1.0"})
                if response.status_code == 404:
                    return None
                if response.status_code == 429:
                    logger.warning("Unpaywall rate limit hit (429)")
                    return None
                response.raise_for_status()
                data = response.json()
                
                is_oa = bool(data.get("is_oa", False))
                oa_status = data.get("oa_status")
                best_location = data.get("best_oa_location") or {}
                
                pdf_url = best_location.get("url_for_pdf")
                landing_page_url = best_location.get("url_for_landing_page") or best_location.get("url")
                
                return {
                    "is_oa": is_oa,
                    "oa_status": oa_status,
                    "pdf_url": pdf_url,
                    "landing_page_url": landing_page_url,
                    "journal_name": data.get("journal_name"),
                    "title": data.get("title"),
                    "year": data.get("year"),
                }
            except httpx.HTTPStatusError as e:
                logger.warning(f"Unpaywall HTTP error {e.response.status_code} for DOI {clean_doi}")
                return None
            except Exception as e:
                logger.warning(f"Unpaywall request error for DOI {clean_doi}: {e}")
                return None
