from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class WorkspaceRename(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class WorkspaceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    is_default: bool
    created_at: datetime
    updated_at: datetime
    document_count: int
    member_count: int


class WorkspaceMemberAdd(BaseModel):
    user_id: int


class WorkspaceMemberRead(BaseModel):
    user_id: int
    email: str
    role: str
