from pydantic import BaseModel


class ChunkMetadata(BaseModel):
    text: str
    source: str
    page: int
    chunk_index: int
    document_id: int | None = None
