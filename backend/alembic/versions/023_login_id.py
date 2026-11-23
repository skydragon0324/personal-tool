"""Sign in and share boards with a login ID instead of an email.

Each account's ID comes from the part of its email before the @. Pending email invitations are
removed, because a board can now only be shared with someone who already has an ID.

Revision ID: 023_login_id
Revises: 022_task_history
Create Date: 2026-11-23
"""

import re
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "023_login_id"
down_revision: Union[str, None] = "022_task_history"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MAX_LENGTH = 32


def _base_login_id(email: str) -> str:
    local = email.split("@", 1)[0].strip().lower()
    cleaned = re.sub(r"[^a-z0-9._-]", "", local)
    cleaned = re.sub(r"^[._-]+", "", cleaned)[:MAX_LENGTH]
    return cleaned if len(cleaned) >= 3 else f"user-{cleaned}".rstrip("-")


def _unique(base: str, used: set[str]) -> str:
    candidate = base
    suffix = 2
    while candidate in used:
        ending = f"-{suffix}"
        candidate = f"{base[:MAX_LENGTH - len(ending)]}{ending}"
        suffix += 1
    used.add(candidate)
    return candidate


def upgrade() -> None:
    op.add_column("users", sa.Column("login_id", sa.String(length=MAX_LENGTH), nullable=True))

    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, email FROM users ORDER BY created_at, id")).all()
    used: set[str] = set()
    for row in rows:
        bind.execute(
            sa.text("UPDATE users SET login_id = :login_id WHERE id = :id"),
            {"login_id": _unique(_base_login_id(row.email), used), "id": row.id},
        )

    op.alter_column("users", "login_id", nullable=False)
    op.create_index("uq_users_login_id_lower", "users", [sa.text("lower(login_id)")], unique=True)
    op.drop_index("uq_users_email_lower", table_name="users")
    op.drop_column("users", "email")
    op.drop_table("board_invitations")


def downgrade() -> None:
    """Original email addresses cannot be recovered; accounts get a placeholder address."""
    op.create_table(
        "board_invitations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "board_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("boards.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column(
            "invited_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("board_id", "email", name="uq_board_invitations_board_email"),
    )
    op.create_index("ix_board_invitations_board_id", "board_invitations", ["board_id"])
    op.create_index("ix_board_invitations_email", "board_invitations", ["email"])

    op.add_column("users", sa.Column("email", sa.String(length=320), nullable=True))
    op.execute("UPDATE users SET email = login_id || '@invalid.local'")
    op.alter_column("users", "email", nullable=False)
    op.create_index("uq_users_email_lower", "users", [sa.text("lower(email)")], unique=True)
    op.drop_index("uq_users_login_id_lower", table_name="users")
    op.drop_column("users", "login_id")
