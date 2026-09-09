from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    owner_id: int
    workspace_id: int
    content_type: str | None
    size_bytes: int | None
    ocr_used: bool
    uploaded_at: datetime
    # Derived, not a real column - documents uploaded before file storage
    # existed have no original file to view/download. Set explicitly by the
    # route (storage_path itself is never exposed to the client).
    file_available: bool


class DocumentRename(BaseModel):
    filename: str = Field(..., min_length=1, max_length=512)
