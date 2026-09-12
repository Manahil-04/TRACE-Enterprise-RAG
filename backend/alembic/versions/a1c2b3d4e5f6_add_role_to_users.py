"""add role to users

Revision ID: a1c2b3d4e5f6
Revises: 1cbae49e8fde
Create Date: 2026-08-30 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1c2b3d4e5f6"
down_revision: str | Sequence[str] | None = "1cbae49e8fde"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("role", sa.String(length=20), nullable=False, server_default="user"),
    )
    op.alter_column("users", "role", server_default=None)

    # Bootstrap: the very first registered user becomes admin, since no user
    # has any role today. New registrations get this same treatment in code
    # (app/api/auth.py) - this only fixes up whatever already exists.
    op.execute(
        "UPDATE users SET role = 'admin' WHERE id = (SELECT id FROM users ORDER BY id ASC LIMIT 1)"
    )


def downgrade() -> None:
    op.drop_column("users", "role")
