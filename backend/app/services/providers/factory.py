from functools import lru_cache

from app.core.config import settings
from app.services.providers.base import EmbeddingProvider, LLMProvider
from app.services.providers.gemini import GeminiEmbeddingProvider, GeminiLLMProvider
from app.services.providers.ollama import OllamaEmbeddingProvider, OllamaLLMProvider


@lru_cache(maxsize=1)
def get_embedding_provider() -> EmbeddingProvider:
    if settings.EMBEDDING_PROVIDER == "gemini":
        return GeminiEmbeddingProvider()
    return OllamaEmbeddingProvider()


@lru_cache(maxsize=1)
def get_llm_provider() -> LLMProvider:
    if settings.LLM_PROVIDER == "gemini":
        return GeminiLLMProvider()
    return OllamaLLMProvider()
