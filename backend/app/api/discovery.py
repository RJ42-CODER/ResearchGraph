import logging
from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from app.schemas.discovery import DiscoverySearchResponse, DiscoveryDoiResponse
from app.services.discovery import discovery_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/discovery", tags=["Research Discovery"])


@router.get("/search", response_model=DiscoverySearchResponse)
async def search_papers(
    q: str = Query(..., min_length=1, description="Academic literature search keywords or title"),
    provider: str = Query("all", description="Provider selection: 'all', 'openalex', or 'crossref'"),
    limit: int = Query(15, ge=1, le=50, description="Maximum number of results to return"),
):
    try:
        return await discovery_service.search(query=q, provider=provider, limit=limit)
    except Exception as e:
        logger.error(f"Search endpoint failure: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Academic search encountered an error: {str(e)}")


@router.get("/doi/{doi:path}", response_model=DiscoveryDoiResponse)
async def lookup_by_doi(
    doi: str,
):
    try:
        result = await discovery_service.get_by_doi(doi=doi)
        return result
    except Exception as e:
        logger.error(f"DOI lookup endpoint failure for '{doi}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"DOI lookup encountered an error: {str(e)}")
