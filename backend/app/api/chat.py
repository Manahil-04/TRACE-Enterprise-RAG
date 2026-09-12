import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import ensure_workspace_access, get_current_user
from app.models.document import Document
from app.models.exploration import Exploration
from app.models.message import Message
from app.models.user import User
from app.schemas.chat import ChatRequest, ChatResponse, SourceChunk
from app.services.llm import generate_answer
from app.services.retrieval import retrieve
from app.services.settings import get_settings_row
from app.services.titles import derive_title

router = APIRouter()

# Bounded conversation memory for follow-ups: enough for the model to resolve
# references like "it" or "that service", without unbounded context growth as
# an Exploration accumulates messages over time.
MAX_HISTORY_TURNS = 3

NO_SOURCES_ANSWER = "No sufficiently relevant internal sources were found in the knowledge base to answer this question."

_FOLLOW_UP_MARKER = re.compile(r"\n+continue exploring:?\s*\n", re.IGNORECASE)
_MAX_FOLLOW_UPS = 3


def split_follow_up_questions(raw_answer: str) -> tuple[str, list[str]]:
    """Split the model's own "Continue exploring:" section (see build_rag_prompt)
    out of its response. Best-effort: models don't always include or format it
    exactly as asked, so an absent/malformed section just yields no suggestions
    rather than breaking the answer."""
    match = _FOLLOW_UP_MARKER.search(raw_answer)
    if not match:
        return raw_answer.strip(), []

    answer = raw_answer[: match.start()].strip()
    suggestions: list[str] = []
    for line in raw_answer[match.end() :].splitlines():
        cleaned = re.sub(r"^[-*•]\s*", "", line.strip())
        if cleaned:
            suggestions.append(cleaned)
        if len(suggestions) >= _MAX_FOLLOW_UPS:
            break
    return answer or raw_answer.strip(), suggestions


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatResponse:
    exploration: Exploration | None = None
    history: list[tuple[str, str]] = []

    if request.exploration_id is not None:
        exploration = db.get(Exploration, request.exploration_id)
        if exploration is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exploration not found")
        if exploration.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this exploration"
            )
        workspace_id = exploration.workspace_id
        recent = (
            db.execute(
                select(Message)
                .where(Message.exploration_id == exploration.id)
                .order_by(Message.created_at.desc())
                .limit(MAX_HISTORY_TURNS)
            )
            .scalars()
            .all()
        )
        history = [(m.question, m.answer) for m in reversed(recent)]
    else:
        if request.workspace_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="workspace_id is required when starting a new exploration",
            )
        ensure_workspace_access(db, current_user, request.workspace_id)
        workspace_id = request.workspace_id

    workspace_documents = db.execute(select(Document).where(Document.workspace_id == workspace_id)).scalars().all()
    documents_by_id = {d.id: d for d in workspace_documents}
    document_ids = list(documents_by_id.keys())

    rag_settings = get_settings_row(db)
    k = request.k if request.k is not None else rag_settings.default_top_k

    # Every question gets fresh retrieval against the current question alone,
    # scoped to this workspace's documents - conversation history informs
    # generation (below), not what gets searched.
    try:
        chunks = retrieve(request.query, k=k, document_ids=document_ids)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to search the knowledge base. Please try again.",
        ) from exc

    sources = [
        SourceChunk(
            text=c.text,
            source=c.source,
            page=c.page,
            document_id=c.document_id,
            file_available=bool(documents_by_id[c.document_id].storage_path) if c.document_id in documents_by_id else False,
        )
        for c in chunks
    ]

    if not chunks:
        # Nothing to ground an answer in - say so plainly rather than asking
        # the model to answer from no context.
        answer: str = NO_SOURCES_ANSWER
        follow_ups: list[str] = []
    else:
        try:
            raw_answer = generate_answer(request.query, [c.text for c in chunks], history=history or None)
        except Exception:
            # Retrieval succeeded, so the evidence is real and worth keeping in
            # the response even though we have no answer. Nothing is persisted -
            # the caller can just retry the same question.
            return ChatResponse(
                exploration_id=exploration.id if exploration else None,
                exploration_title=exploration.title if exploration else None,
                message_id=None,
                answer=None,
                sources=sources,
                follow_up_questions=[],
                generation_failed=True,
            )
        answer, follow_ups = split_follow_up_questions(raw_answer)

    if exploration is None:
        exploration = Exploration(
            owner_id=current_user.id, workspace_id=workspace_id, title=derive_title(request.query)
        )
        db.add(exploration)
        db.flush()  # assign exploration.id before the message references it

    message = Message(
        exploration_id=exploration.id,
        question=request.query,
        answer=answer,
        sources=[s.model_dump() for s in sources],
        follow_up_questions=follow_ups,
    )
    exploration.updated_at = datetime.now(timezone.utc)
    db.add(message)
    db.commit()
    db.refresh(exploration)
    db.refresh(message)

    return ChatResponse(
        exploration_id=exploration.id,
        exploration_title=exploration.title,
        message_id=message.id,
        answer=answer,
        sources=sources,
        follow_up_questions=follow_ups,
        generation_failed=False,
    )
