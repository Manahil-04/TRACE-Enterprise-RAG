from typing import Any, cast

import httpx

from app.core.config import settings
from app.services.providers.prompts import build_rag_prompt

_TIMEOUT = httpx.Timeout(120.0)


class OllamaEmbeddingProvider:
    def __init__(self) -> None:
        self._base_url = settings.OLLAMA_BASE_URL.rstrip("/")
        self._model = settings.OLLAMA_EMBEDDING_MODEL

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        response = httpx.post(
            f"{self._base_url}/api/embed",
            json={"model": self._model, "input": texts},
            timeout=_TIMEOUT,
        )
        response.raise_for_status()
        data: dict[str, Any] = response.json()
        embeddings = data.get("embeddings")
        if not embeddings:
            raise ValueError(f"Ollama returned no embeddings (model={self._model})")
        return cast(list[list[float]], embeddings)


class OllamaLLMProvider:
    def __init__(self) -> None:
        self._base_url = settings.OLLAMA_BASE_URL.rstrip("/")
        self._model = settings.OLLAMA_LLM_MODEL

    def generate_answer(self, query: str, context_chunks: list[str]) -> str:
        prompt = build_rag_prompt(query, context_chunks)
        response = httpx.post(
            f"{self._base_url}/api/generate",
            json={"model": self._model, "prompt": prompt, "stream": False},
            timeout=_TIMEOUT,
        )
        response.raise_for_status()
        data: dict[str, Any] = response.json()
        answer = data.get("response")
        if not answer:
            raise ValueError(f"Ollama returned an empty response (model={self._model})")
        return str(answer)
