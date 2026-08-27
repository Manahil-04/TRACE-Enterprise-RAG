from typing import Protocol, runtime_checkable


@runtime_checkable
class EmbeddingProvider(Protocol):
    def embed_texts(self, texts: list[str]) -> list[list[float]]: ...


@runtime_checkable
class LLMProvider(Protocol):
    def generate_answer(
        self, query: str, context_chunks: list[str], history: list[tuple[str, str]] | None = None
    ) -> str: ...
