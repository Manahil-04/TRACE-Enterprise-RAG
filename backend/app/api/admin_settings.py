from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import require_admin
from app.models.user import User
from app.schemas.settings import SettingsRead, SettingsUpdate
from app.services.settings import get_settings_row

router = APIRouter(prefix="/admin/settings", tags=["admin"])


@router.get("", response_model=SettingsRead, dependencies=[Depends(require_admin)])
def read_settings(db: Session = Depends(get_db)) -> SettingsRead:
    return SettingsRead.model_validate(get_settings_row(db))


@router.put("", response_model=SettingsRead)
def update_settings(
    payload: SettingsUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> SettingsRead:
    settings_row = get_settings_row(db)
    settings_row.default_top_k = payload.default_top_k
    settings_row.chunk_size = payload.chunk_size
    settings_row.chunk_overlap = payload.chunk_overlap
    settings_row.ocr_enabled = payload.ocr_enabled
    settings_row.updated_by_id = current_user.id
    settings_row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(settings_row)
    return SettingsRead.model_validate(settings_row)
