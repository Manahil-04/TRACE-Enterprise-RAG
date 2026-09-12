from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.exploration import Exploration
    from app.models.workspace_membership import WorkspaceMembership

# Plain string, not a DB-level enum/CHECK constraint, so new roles can be added
# later without a migration - validated at the API boundary (schemas/auth.py)
# instead. "admin" bypasses workspace-membership checks everywhere; "user" is
# scoped to workspaces they're an explicit member of.
DEFAULT_ROLE = "user"
ADMIN_ROLE = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default=DEFAULT_ROLE)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    documents: Mapped[list["Document"]] = relationship(back_populates="owner")
    explorations: Mapped[list["Exploration"]] = relationship(back_populates="owner")
    workspace_memberships: Mapped[list["WorkspaceMembership"]] = relationship(back_populates="user")
