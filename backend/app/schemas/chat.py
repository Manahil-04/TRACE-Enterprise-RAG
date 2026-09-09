from pydantic import BaseModel, Field

from app.schemas.settings import TOP_K_MAX, TOP_K_MIN


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1)
    # Omitted -> the admin-configured default (AppSettings.default_top_k) is
    # used. Still bounds-checked when provided, matching those same bounds.
    k: int | None = Field(default=None, ge=TOP_K_MIN, le=TOP_K_MAX)
    # Omitted/null starts a new Exploration; set it to ask a follow-up inside
    # an existing one.
    exploration_id: int | None = None
    # Required when starting a new Exploration (exploration_id is None) - it
    # fixes which workspace's documents get retrieved against. Ignored for
    # follow-ups, which inherit the workspace their Exploration already has.
    workspace_id: int | None = None


class SourceChunk(BaseModel):
    text: str
    source: str
    page: int
    # None for older messages persisted before this field existed, or if the
    # source document has since been deleted - the frontend hides the "open
    # source" link in that case rather than linking to a document that's gone.
    document_id: int | None = None
    file_available: bool = False


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
