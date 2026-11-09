import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

# Resolve paths independently of current working directory
APP_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = APP_DIR.parent
ENV_PATH = BACKEND_DIR / ".env"

if not ENV_PATH.is_file():
    alt_env = APP_DIR / ".env"
    if alt_env.is_file():
        ENV_PATH = alt_env

load_dotenv(dotenv_path=ENV_PATH)


class Settings:
    # OpenAlex Configuration
    OPENALEX_API_URL: str = os.getenv("OPENALEX_API_URL", "https://api.openalex.org").rstrip("/")
    OPENALEX_API_KEY: Optional[str] = os.getenv("OPENALEX_API_KEY") or None

    # Crossref Configuration
    CROSSREF_API_URL: str = os.getenv("CROSSREF_API_URL", "https://api.crossref.org").rstrip("/")
    CROSSREF_MAILTO: Optional[str] = os.getenv("CROSSREF_MAILTO") or None

    # Unpaywall Configuration
    UNPAYWALL_API_URL: str = os.getenv("UNPAYWALL_API_URL", "https://api.unpaywall.org").rstrip("/")
    UNPAYWALL_EMAIL: Optional[str] = os.getenv("UNPAYWALL_EMAIL") or None

    # Preserved Configurations for Future Development (DOAJ, CORE, HuggingFace)
    DOAJ_API_URL: str = os.getenv("DOAJ_API_URL", "https://doaj.org/api").rstrip("/")
    CORE_API_URL: str = os.getenv("CORE_API_URL", "https://api.core.ac.uk/v3").rstrip("/")
    CORE_API_KEY: Optional[str] = os.getenv("CORE_API_KEY") or None
    HUGGINGFACE_API_KEY: Optional[str] = os.getenv("HUGGINGFACE_API_KEY") or None
    HF_MULTILINGUAL_MODEL_URL: Optional[str] = os.getenv("HF_MULTILINGUAL_MODEL_URL") or None
    HF_BGE_SMALL_MODEL_URL: Optional[str] = os.getenv("HF_BGE_SMALL_MODEL_URL") or None


settings = Settings()
