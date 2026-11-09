from typing import List, Optional
from pydantic import BaseModel, Field


class DiscoveredPaper(BaseModel):
    id: str = Field(..., description="Unique paper identifier (DOI or OpenAlex ID)")
    title: str = Field(..., description="Cleaned paper title")
    authors: List[str] = Field(default_factory=list, description="List of author full names")
    year: Optional[int] = Field(None, description="Publication year")
    doi: Optional[str] = Field(None, description="Normalized DOI string, e.g. 10.1038/...")
    publication: Optional[str] = Field(None, description="Journal, conference, or publisher name")
    abstract: Optional[str] = Field(None, description="Abstract summary if available")
    openalex_id: Optional[str] = Field(None, description="OpenAlex canonical ID, e.g. https://openalex.org/W...")
    is_oa: bool = Field(False, description="Open Access availability flag")
    oa_status: Optional[str] = Field(None, description="Open Access category: gold, green, hybrid, bronze, closed")
    pdf_url: Optional[str] = Field(None, description="Direct URL to open-access PDF if available")
    landing_page_url: Optional[str] = Field(None, description="Publisher or repository landing page URL")
    primary_provider: str = Field("openalex", description="Primary data source: openalex, crossref, or unpaywall")
    providers: List[str] = Field(default_factory=list, description="All data sources contributing to this record")


class DiscoverySearchResponse(BaseModel):
    query: str
    total_results: int
    papers: List[DiscoveredPaper]
    provider: str
    warnings: List[str] = Field(default_factory=list)


class DiscoveryDoiResponse(BaseModel):
    doi: str
    found: bool
    paper: Optional[DiscoveredPaper] = None
    warnings: List[str] = Field(default_factory=list)
