from google.genai import Client, types

from app.core.config import settings
from app.services.providers.prompts import build_rag_prompt


class GeminiEmbeddingProvider:
    def __init__(self) -> None:
        assert settings.GEMINI_API_KEY is not None  # enforced by Settings validator
        self._client = Client(api_key=settings.GEMINI_API_KEY)
        self._model = settings.GEMINI_EMBEDDING_MODEL

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        embeddings: list[list[float]] = []
        config = types.EmbedContentConfig(output_dimensionality=settings.EMBEDDING_DIM)
        for text in texts:
            result = self._client.models.embed_content(
                model=self._model, contents=text, config=config
            )
            if not result.embeddings or result.embeddings[0].values is None:
                raise ValueError("Gemini returned no embedding for input text")
            embeddings.append(result.embeddings[0].values)
        return embeddings


class GeminiLLMProvider:
    def __init__(self) -> None:
        assert settings.GEMINI_API_KEY is not None
        self._client = Client(api_key=settings.GEMINI_API_KEY)
        self._model = settings.GEMINI_LLM_MODEL

    def generate_answer(
        self, query: str, context_chunks: list[str], history: list[tuple[str, str]] | None = None
    ) -> str:
        prompt = build_rag_prompt(query, context_chunks, history)
        response = self._client.models.generate_content(model=self._model, contents=prompt)
        if response.text is None:
            raise ValueError("Gemini returned empty response")
        return response.text
