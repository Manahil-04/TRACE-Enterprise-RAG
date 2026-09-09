"""add workspace and storage fields to documents

Revision ID: c3e4d5f6a1b2
Revises: b2d3c4e5f6a1
Create Date: 2026-08-30 10:10:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3e4d5f6a1b2"
down_revision: str | Sequence[str] | None = "b2d3c4e5f6a1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("workspace_id", sa.Integer(), sa.ForeignKey("workspaces.id"), nullable=True))
    op.add_column("documents", sa.Column("storage_path", sa.String(length=1024), nullable=True))
    op.add_column("documents", sa.Column("content_type", sa.String(length=100), nullable=True))
    op.add_column("documents", sa.Column("size_bytes", sa.Integer(), nullable=True))
    op.add_column(
        "documents", sa.Column("ocr_used", sa.Boolean(), nullable=False, server_default=sa.false())
    )
    op.alter_column("documents", "ocr_used", server_default=None)

    # Every document that predates workspaces belongs to the default one -
    # storage_path stays null for them (see app/services/storage.py); there
    # was never a file on disk to point to.
    op.execute(
        "UPDATE documents SET workspace_id = (SELECT id FROM workspaces WHERE is_default = true)"
    )
    op.alter_column("documents", "workspace_id", nullable=False)


def downgrade() -> None:
    op.drop_column("documents", "ocr_used")
    op.drop_column("documents", "size_bytes")
    op.drop_column("documents", "content_type")
    op.drop_column("documents", "storage_path")
    op.drop_column("documents", "workspace_id")
