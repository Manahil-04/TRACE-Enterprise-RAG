from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1)
    k: int = Field(default=3, ge=1, le=20)


class SourceChunk(BaseModel):
    text: str
    source: str
    page: int


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceChunk]
