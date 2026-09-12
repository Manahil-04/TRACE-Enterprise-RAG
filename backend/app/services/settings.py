from sqlalchemy.orm import Session

from app.models.app_settings import SETTINGS_ROW_ID, AppSettings


def get_settings_row(db: Session) -> AppSettings:
    """The seed migration always creates the id=1 row - this fallback just
    means a missing row degrades to defaults instead of a 500."""
    settings_row = db.get(AppSettings, SETTINGS_ROW_ID)
    if settings_row is None:
        settings_row = AppSettings(id=SETTINGS_ROW_ID)
        db.add(settings_row)
        db.commit()
        db.refresh(settings_row)
    return settings_row
