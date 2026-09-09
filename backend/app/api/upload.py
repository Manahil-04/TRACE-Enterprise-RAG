import io
import logging

import fitz  # PyMuPDF
import pytesseract
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from PIL import Image
from PyPDF2 import PdfReader
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.core.security import ensure_workspace_access, get_current_user
from app.models.document import Document
from app.models.user import User
from app.schemas.chunk import ChunkMetadata
from app.services.embedding import embed_texts
from app.services.settings import get_settings_row
from app.services.storage import save_document_file
from app.services.vector_store import get_vector_store

router = APIRouter()

logger = logging.getLogger(__name__)

if settings.TESSERACT_CMD:
    pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD


def _ocr_page(pdf_doc: "fitz.Document", page_index: int, dpi: int = 200) -> str:
    """Rasterizes one page and OCRs it. Returns "" (never raises) if Tesseract
    isn't installed/reachable on this machine - a page that already had no
    extractable text just stays that way rather than failing the whole upload."""
    try:
        page = pdf_doc.load_page(page_index)
        pixmap = page.get_pixmap(dpi=dpi)
        image = Image.open(io.BytesIO(pixmap.tobytes("png")))
        return str(pytesseract.image_to_string(image))
    except pytesseract.TesseractNotFoundError:
        logger.warning("OCR requested but the Tesseract binary isn't installed/on PATH")
        return ""
    except Exception:
        logger.exception("OCR failed for page %d", page_index + 1)
        return ""


def extract_pages(raw_bytes: bytes, *, ocr_enabled: bool) -> tuple[list[tuple[int, str]], bool]:
    """Extracts text per page via PyPDF2; any page with no extractable text
    (typically a scanned/image page) falls back to OCR via PyMuPDF + Tesseract
    when ocr_enabled. Returns (pages, ocr_was_used)."""
    reader = PdfReader(io.BytesIO(raw_bytes))
    pages: list[tuple[int, str]] = []
    ocr_used = False
    pdf_doc: fitz.Document | None = None

    try:
        for i, page in enumerate(reader.pages):
            text = (page.extract_text() or "").strip()
            if not text and ocr_enabled:
                if pdf_doc is None:
                    pdf_doc = fitz.open(stream=raw_bytes, filetype="pdf")
                text = _ocr_page(pdf_doc, i).strip()
                if text:
                    ocr_used = True
            pages.append((i + 1, text))
    finally:
        if pdf_doc is not None:
            pdf_doc.close()

    return pages, ocr_used


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap

    return chunks


def build_chunks(
    pages: list[tuple[int, str]], filename: str, chunk_size: int = 500, overlap: int = 50
) -> list[ChunkMetadata]:
    chunks: list[ChunkMetadata] = []
    chunk_index = 0
    for page_number, page_text in pages:
        for piece in chunk_text(page_text, chunk_size, overlap):
            if not piece.strip():
                continue
            chunks.append(
                ChunkMetadata(text=piece, source=filename, page=page_number, chunk_index=chunk_index)
            )
            chunk_index += 1
    return chunks


@router.post("/upload")
async def upload(
    workspace_id: int = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str | int]:
    ensure_workspace_access(db, current_user, workspace_id)

    filename = file.filename or "unknown"
    raw_bytes = await file.read()

    rag_settings = get_settings_row(db)
    pages, ocr_used = extract_pages(raw_bytes, ocr_enabled=rag_settings.ocr_enabled)
    chunks = build_chunks(pages, filename, rag_settings.chunk_size, rag_settings.chunk_overlap)

    if not chunks:
        raise HTTPException(status_code=400, detail="No extractable text found in PDF")

    storage_path = save_document_file(raw_bytes, filename)

    document = Document(
        filename=filename,
        owner_id=current_user.id,
        workspace_id=workspace_id,
        storage_path=storage_path,
        content_type=file.content_type,
        size_bytes=len(raw_bytes),
        ocr_used=ocr_used,
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    for chunk in chunks:
        chunk.document_id = document.id

    embeddings = embed_texts([c.text for c in chunks])
    get_vector_store().add(chunks, embeddings)

    return {
        "message": f"{len(chunks)} chunks stored",
        "filename": filename,
        "document_id": document.id,
        "ocr_used": ocr_used,
    }
