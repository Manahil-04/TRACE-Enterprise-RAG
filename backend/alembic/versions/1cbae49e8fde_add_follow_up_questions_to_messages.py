"""add follow_up_questions to messages

Revision ID: 1cbae49e8fde
Revises: e77b3d4d24f1
Create Date: 2026-08-27 03:02:58.343455

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1cbae49e8fde"
down_revision: str | Sequence[str] | None = "e77b3d4d24f1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "messages",
        sa.Column(
            "follow_up_questions",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
    )
    op.alter_column("messages", "follow_up_questions", server_default=None)


def downgrade() -> None:
    op.drop_column("messages", "follow_up_questions")
