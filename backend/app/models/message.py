from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.exploration import Exploration


class Message(Base):
    """One question/answer turn within an Exploration, with its own evidence.

    Deliberately not split into separate user/assistant rows: every answer in
    this product must keep its own evidence set (see ChatResponse.sources), so
    a question and its answer+sources are always read and written together.
    """

    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    exploration_id: Mapped[int] = mapped_column(ForeignKey("explorations.id"), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    # List of SourceChunk-shaped dicts ({text, source, page}) - denormalized
    # rather than a FK, since `chunks` is a raw-SQL table outside the ORM/Alembic
    # (see app/services/vector_store/pgvector_store.py).
    sources: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    # Short "Continue exploring" follow-up questions parsed out of the LLM's own
    # response (see split_follow_up_questions in app/api/chat.py) - empty when
    # the model didn't include any, which is fine, the UI just omits the section.
    follow_up_questions: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    exploration: Mapped["Exploration"] = relationship(back_populates="messages")
