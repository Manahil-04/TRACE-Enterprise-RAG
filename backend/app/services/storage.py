import uuid
from pathlib import Path

from app.core.config import settings


def _storage_root() -> Path:
    root = Path(settings.STORAGE_DIR)
    root.mkdir(parents=True, exist_ok=True)
    return root


def save_document_file(raw_bytes: bytes, original_filename: str) -> str:
    """Writes the file under a generated name, not the user's filename, so
    renaming a document (a plain metadata update) never has to touch - or
    risk breaking - the file already on disk. Returns the path to store on
    Document.storage_path."""
    ext = Path(original_filename).suffix
    generated_name = f"{uuid.uuid4().hex}{ext}"
    path = _storage_root() / generated_name
    path.write_bytes(raw_bytes)
    return str(path)


def read_document_file(storage_path: str) -> bytes:
    return Path(storage_path).read_bytes()


def delete_document_file(storage_path: str | None) -> None:
    if not storage_path:
        return
    path = Path(storage_path)
    if path.exists():
        path.unlink()
