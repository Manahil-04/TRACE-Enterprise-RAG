from pydantic import BaseModel


class ChunkMetadata(BaseModel):
    text: str
    source: str
    page: int
    chunk_index: int
    document_id: int | None = None
    # Cosine distance to the query embedding (0 = identical, larger = less
    # similar). Only populated by similarity search, not by inserts - None
    # unless the caller asked search() to include it.
    distance: float | None = None
