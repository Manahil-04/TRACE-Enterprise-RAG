from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import ensure_workspace_access, get_current_user
from app.models.document import Document
from app.models.user import User
from app.schemas.search import SearchResponse, SearchResult
from app.services.retrieval import retrieve
from app.services.settings import get_settings_row

router = APIRouter(prefix="/search", tags=["search"])

# Cosine distance beyond which a chunk is treated as "not actually about this
# query" rather than merely the least-bad of an unrelated top-k - pgvector's
# nearest-neighbor search always returns k rows regardless of relevance, so
# without a cutoff a nonsense query would still show results. Calibrated
# empirically against this project's own documents (nomic-embed-text):
# genuinely relevant matches landed at ~0.24-0.40, clear nonsense at ~0.50+.
MAX_RESULT_DISTANCE = 0.45


@router.get("", response_model=SearchResponse)
def search_documents(
    workspace_id: int,
    query: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SearchResponse:
    ensure_workspace_access(db, current_user, workspace_id)

    documents = db.execute(select(Document).where(Document.workspace_id == workspace_id)).scalars().all()
    documents_by_id = {d.id: d for d in documents}

    rag_settings = get_settings_row(db)
    chunks = retrieve(query, k=rag_settings.default_top_k, document_ids=list(documents_by_id.keys()))

    results = []
    for chunk in chunks:
        if chunk.distance is not None and chunk.distance > MAX_RESULT_DISTANCE:
            continue
        document = documents_by_id.get(chunk.document_id) if chunk.document_id is not None else None
        if document is None:
            # A chunk whose document has since been deleted/renamed out of this
            # workspace - shouldn't normally happen since documents_by_id came
            # from the same workspace_id just above, but skip rather than 500.
            continue
        results.append(
            SearchResult(
                document_id=document.id,
                filename=document.filename,
                page=chunk.page,
                chunk_index=chunk.chunk_index,
                snippet=chunk.text,
                file_available=bool(document.storage_path),
            )
        )

    return SearchResponse(results=results)
