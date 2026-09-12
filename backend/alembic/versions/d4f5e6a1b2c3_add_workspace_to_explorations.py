"""add workspace to explorations

Revision ID: d4f5e6a1b2c3
Revises: c3e4d5f6a1b2
Create Date: 2026-08-30 10:15:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4f5e6a1b2c3"
down_revision: str | Sequence[str] | None = "c3e4d5f6a1b2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "explorations", sa.Column("workspace_id", sa.Integer(), sa.ForeignKey("workspaces.id"), nullable=True)
    )
    # Existing explorations predate workspaces entirely - they belong to the
    # default one, same as pre-existing documents.
    op.execute(
        "UPDATE explorations SET workspace_id = (SELECT id FROM workspaces WHERE is_default = true)"
    )
    op.alter_column("explorations", "workspace_id", nullable=False)


def downgrade() -> None:
    op.drop_column("explorations", "workspace_id")
