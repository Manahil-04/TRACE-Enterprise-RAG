from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user
from app.models.document import Document
from app.models.user import User
from app.schemas.document import DocumentRead
from app.services.vector_store import get_vector_store

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=list[DocumentRead])
def list_documents(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[Document]:
    # Shared org-wide visibility: every authenticated user sees every document.
    return list(db.execute(select(Document).order_by(Document.uploaded_at.desc())).scalars())


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Visibility is shared, but deletion is destructive - restrict it to the uploader.
    if document.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only the uploader can delete this document"
        )

    # Chunks reference documents via a plain FK (no ON DELETE CASCADE), so they
    # must be removed first or the Document delete below violates the FK.
    get_vector_store().delete_by_document(document_id)
    db.delete(document)
    db.commit()
