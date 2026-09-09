from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.chat import SourceChunk


class MessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    question: str
    answer: str
    sources: list[SourceChunk]
    follow_up_questions: list[str]
    created_at: datetime


class ExplorationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    workspace_id: int
    created_at: datetime
    updated_at: datetime
    message_count: int


class ExplorationDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    workspace_id: int
    created_at: datetime
    updated_at: datetime
    messages: list[MessageRead]


class ExplorationRename(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
