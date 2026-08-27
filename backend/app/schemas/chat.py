from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1)
    k: int = Field(default=3, ge=1, le=20)
    # Omitted/null starts a new Exploration; set it to ask a follow-up inside
    # an existing one.
    exploration_id: int | None = None


class SourceChunk(BaseModel):
    text: str
    source: str
    page: int


class ChatResponse(BaseModel):
    exploration_id: int | None
    exploration_title: str | None
    message_id: int | None
    answer: str | None
    sources: list[SourceChunk]
    follow_up_questions: list[str] = []
    # True when retrieval succeeded but answer generation failed - sources are
    # still returned so the caller can show evidence even without an answer.
    # Nothing is persisted in this case; the caller can just retry.
    generation_failed: bool = False
