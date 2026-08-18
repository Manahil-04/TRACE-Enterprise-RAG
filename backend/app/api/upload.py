from typing import BinaryIO

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PyPDF2 import PdfReader
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user
from app.models.document import Document
from app.models.user import User
from app.schemas.chunk import ChunkMetadata
from app.services.embedding import embed_texts
from app.services.vector_store import get_vector_store

router = APIRouter()


def extract_pages(file: BinaryIO) -> list[tuple[int, str]]:
    reader = PdfReader(file)
    return [(i + 1, page.extract_text() or "") for i, page in enumerate(reader.pages)]


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
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str | int]:
    filename = file.filename or "unknown"
    pages = extract_pages(file.file)
    chunks = build_chunks(pages, filename)

    if not chunks:
        raise HTTPException(status_code=400, detail="No extractable text found in PDF")

    document = Document(filename=filename, owner_id=current_user.id)
    db.add(document)
    db.commit()
    db.refresh(document)

    for chunk in chunks:
        chunk.document_id = document.id

    embeddings = embed_texts([c.text for c in chunks])
    get_vector_store().add(chunks, embeddings)

    return {"message": f"{len(chunks)} chunks stored", "filename": filename, "document_id": document.id}
