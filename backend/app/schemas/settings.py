from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

# Shared bounds so the API validation and the frontend's number inputs never
# drift apart - see frontend/src/pages/AdminSettingsPage.tsx.
TOP_K_MIN = 1
TOP_K_MAX = 20
CHUNK_SIZE_MIN = 100
CHUNK_SIZE_MAX = 2000
CHUNK_OVERLAP_MIN = 0
CHUNK_OVERLAP_MAX = 500


class SettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    default_top_k: int
    chunk_size: int
    chunk_overlap: int
    ocr_enabled: bool
    updated_at: datetime


class SettingsUpdate(BaseModel):
    default_top_k: int = Field(..., ge=TOP_K_MIN, le=TOP_K_MAX)
    chunk_size: int = Field(..., ge=CHUNK_SIZE_MIN, le=CHUNK_SIZE_MAX)
    chunk_overlap: int = Field(..., ge=CHUNK_OVERLAP_MIN, le=CHUNK_OVERLAP_MAX)
    ocr_enabled: bool = True

    @model_validator(mode="after")
    def _overlap_must_be_smaller_than_chunk_size(self) -> "SettingsUpdate":
        # chunk_text's sliding window (start += chunk_size - overlap) never
        # advances - or goes backwards - if overlap >= chunk_size, hanging on
        # any non-trivial document. Reject it here rather than let it happen.
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError("chunk_overlap must be smaller than chunk_size")
        return self
