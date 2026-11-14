import os
from pathlib import Path
from typing import Optional, List
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
    # Environment & Deployment
    APP_ENV: str = os.getenv("APP_ENV", "development").lower()

    # CORS
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "")

    # Storage directory (for SQLite DB, uploads, and ChromaDB)
    RESEARCHGRAPH_DATA_DIR: str = os.getenv(
        "RESEARCHGRAPH_DATA_DIR", str(BACKEND_DIR / "data")
    )

    # Security: In production, sandbox code execution is disabled by default
    ENABLE_SANDBOX_EXECUTION: bool = os.getenv(
        "ENABLE_SANDBOX_EXECUTION",
        "true" if os.getenv("APP_ENV", "development").lower() not in ("production", "prod") else "false",
    ).lower() in ("true", "1", "yes")

    # Uploads
    MAX_UPLOAD_MB: int = int(os.getenv("MAX_UPLOAD_MB", "10"))

    # Ollama Configuration
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
    OLLAMA_CHAT_MODEL: str = os.getenv("OLLAMA_CHAT_MODEL", "llama3.2:3b")
    OLLAMA_EMBEDDING_MODEL: str = os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")
    OLLAMA_NUM_THREADS: int = int(os.getenv("OLLAMA_NUM_THREADS", "8"))
    OLLAMA_KEEP_ALIVE: str = os.getenv("OLLAMA_KEEP_ALIVE", "1h")
    OLLAMA_REQUEST_TIMEOUT: float = float(os.getenv("OLLAMA_REQUEST_TIMEOUT", "4.0"))

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

    @property
    def is_production(self) -> bool:
        return self.APP_ENV in ("production", "prod")

    def get_cors_origins(self) -> List[str]:
        if self.CORS_ORIGINS.strip():
            return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        if self.is_production:
            return []
        return ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000"]


settings = Settings()

# Ensure the data directory exists
os.makedirs(settings.RESEARCHGRAPH_DATA_DIR, exist_ok=True)
