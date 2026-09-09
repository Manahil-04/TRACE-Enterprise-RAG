import mimetypes

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import ensure_workspace_access, get_current_user
from app.models.document import Document
from app.models.user import ADMIN_ROLE, User
from app.schemas.document import DocumentRead, DocumentRename
from app.services.storage import delete_document_file, read_document_file
from app.services.vector_store import get_vector_store

router = APIRouter(prefix="/documents", tags=["documents"])


def _to_read(document: Document) -> DocumentRead:
    return DocumentRead(
        id=document.id,
        filename=document.filename,
        owner_id=document.owner_id,
        workspace_id=document.workspace_id,
        content_type=document.content_type,
        size_bytes=document.size_bytes,
        ocr_used=document.ocr_used,
        uploaded_at=document.uploaded_at,
        file_available=bool(document.storage_path),
    )


def _get_document_or_404(db: Session, document_id: int) -> Document:
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


def _require_owner_or_admin(document: Document, user: User, action: str) -> None:
    if document.owner_id != user.id and user.role != ADMIN_ROLE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Only the uploader or an admin can {action} this document",
        )


@router.get("", response_model=list[DocumentRead])
def list_documents(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DocumentRead]:
    ensure_workspace_access(db, current_user, workspace_id)
    documents = db.execute(
        select(Document).where(Document.workspace_id == workspace_id).order_by(Document.uploaded_at.desc())
    ).scalars()
    return [_to_read(d) for d in documents]


@router.patch("/{document_id}", response_model=DocumentRead)
def rename_document(
    document_id: int,
    payload: DocumentRename,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentRead:
    document = _get_document_or_404(db, document_id)
    _require_owner_or_admin(document, current_user, "rename")

    document.filename = payload.filename
    db.commit()
    db.refresh(document)
    return _to_read(document)


@router.get("/{document_id}/view")
def view_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    return _serve_document_file(db, current_user, document_id, disposition="inline")


@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    return _serve_document_file(db, current_user, document_id, disposition="attachment")


def _serve_document_file(db: Session, current_user: User, document_id: int, *, disposition: str) -> Response:
    document = _get_document_or_404(db, document_id)
    ensure_workspace_access(db, current_user, document.workspace_id)

    if not document.storage_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The original file for this document isn't available - it was uploaded before file storage existed",
        )

    try:
        content = read_document_file(document.storage_path)
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="The stored file is missing on disk"
        ) from exc

    content_type = document.content_type or mimetypes.guess_type(document.filename)[0] or "application/octet-stream"
    return Response(
        content=content,
        media_type=content_type,
        headers={"Content-Disposition": f'{disposition}; filename="{document.filename}"'},
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    document = _get_document_or_404(db, document_id)
    _require_owner_or_admin(document, current_user, "delete")

    # Chunks reference documents via a plain FK (no ON DELETE CASCADE), so they
    # must be removed first or the Document delete below violates the FK.
    get_vector_store().delete_by_document(document_id)
    delete_document_file(document.storage_path)
    db.delete(document)
    db.commit()
