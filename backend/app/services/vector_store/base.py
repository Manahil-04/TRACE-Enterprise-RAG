from typing import Protocol, runtime_checkable

from app.schemas.chunk import ChunkMetadata


@runtime_checkable
class VectorStore(Protocol):
    def add(self, chunks: list[ChunkMetadata], embeddings: list[list[float]]) -> None: ...

    def search(self, query_embedding: list[float], k: int) -> list[ChunkMetadata]: ...

    def delete_by_document(self, document_id: int) -> None: ...
