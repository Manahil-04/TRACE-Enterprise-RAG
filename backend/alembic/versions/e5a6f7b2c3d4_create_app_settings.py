"""create app_settings

Revision ID: e5a6f7b2c3d4
Revises: d4f5e6a1b2c3
Create Date: 2026-08-30 10:20:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e5a6f7b2c3d4"
down_revision: str | Sequence[str] | None = "d4f5e6a1b2c3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("default_top_k", sa.Integer(), nullable=False),
        sa.Column("chunk_size", sa.Integer(), nullable=False),
        sa.Column("chunk_overlap", sa.Integer(), nullable=False),
        sa.Column("ocr_enabled", sa.Boolean(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
    )
    # Seed values match what was previously hardcoded (upload.py's chunk_size/
    # overlap defaults, ChatRequest.k's default) so this migration changes no
    # observable behavior on its own.
    op.execute(
        "INSERT INTO app_settings (id, default_top_k, chunk_size, chunk_overlap, ocr_enabled, updated_at) "
        "VALUES (1, 3, 500, 50, true, now())"
    )


def downgrade() -> None:
    op.drop_table("app_settings")
