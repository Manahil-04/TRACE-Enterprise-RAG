from pydantic import BaseModel


class SearchResult(BaseModel):
    document_id: int
    filename: str
    page: int
    chunk_index: int
    snippet: str
    file_available: bool


class SearchResponse(BaseModel):
    results: list[SearchResult]
