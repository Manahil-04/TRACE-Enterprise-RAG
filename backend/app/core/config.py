from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings

EmbeddingProviderKind = Literal["gemini", "ollama"]
LLMProviderKind = Literal["gemini", "ollama"]


class Settings(BaseSettings):
    DEBUG: bool = False

    # Provider selection - local-first defaults for a privacy-conscious org
    EMBEDDING_PROVIDER: EmbeddingProviderKind = "ollama"
    LLM_PROVIDER: LLMProviderKind = "ollama"

    # Gemini (cloud, bring-your-own-key) - optional unless selected above
    GEMINI_API_KEY: str | None = None
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"
    GEMINI_LLM_MODEL: str = "gemini-2.5-flash"

    # Ollama (local/self-hosted)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_EMBEDDING_MODEL: str = "nomic-embed-text"
    OLLAMA_LLM_MODEL: str = "llama3"

    # Vector store - single source of truth for embedding dimension
    EMBEDDING_DIM: int = 768
    DATABASE_URL: str = "postgresql://raguser:ragpass@localhost:5432/ragdb"

    # Where original uploaded files are kept on disk for view/download - see
    # app/services/storage.py. Documents uploaded before this existed have no
    # file here (Document.storage_path is null for them).
    STORAGE_DIR: str = "./storage/documents"

    # Full path to the tesseract binary. Leave unset when it's already on
    # PATH (true in the Docker image, where apt installs it there) - only
    # needed for environments (e.g. a bare Windows dev machine) where it
    # isn't, or wasn't yet when this process started.
    TESSERACT_CMD: str | None = None

    # Auth - no default secret on purpose; app must fail to boot without one set
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 30

    class Config:
        env_file = ".env"

    @model_validator(mode="after")
    def _require_gemini_key_if_selected(self) -> "Settings":
        if "gemini" in (self.EMBEDDING_PROVIDER, self.LLM_PROVIDER) and not self.GEMINI_API_KEY:
            raise ValueError(
                "GEMINI_API_KEY is required when EMBEDDING_PROVIDER or LLM_PROVIDER is 'gemini'"
            )
        return self


settings = Settings()
