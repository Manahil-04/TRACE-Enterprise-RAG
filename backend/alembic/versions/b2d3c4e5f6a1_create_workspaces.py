"""create workspaces and workspace_memberships

Revision ID: b2d3c4e5f6a1
Revises: a1c2b3d4e5f6
Create Date: 2026-08-30 10:05:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2d3c4e5f6a1"
down_revision: str | Sequence[str] | None = "a1c2b3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "workspaces",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_workspaces_name", "workspaces", ["name"], unique=True)
    op.alter_column("workspaces", "is_default", server_default=None)

    op.create_table(
        "workspace_memberships",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("workspace_id", sa.Integer(), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("workspace_id", "user_id", name="uq_workspace_membership"),
    )

    # Seed the default workspace every new user is auto-enrolled into, and
    # backfill membership for everyone who already exists - nobody who could
    # see shared documents before this migration should lose access.
    op.execute(
        "INSERT INTO workspaces (name, is_default, created_at, updated_at) "
        "VALUES ('General', true, now(), now())"
    )
    op.execute(
        "INSERT INTO workspace_memberships (workspace_id, user_id, created_at) "
        "SELECT (SELECT id FROM workspaces WHERE is_default = true), id, now() FROM users"
    )


def downgrade() -> None:
    op.drop_table("workspace_memberships")
    op.drop_index("ix_workspaces_name", table_name="workspaces")
    op.drop_table("workspaces")
