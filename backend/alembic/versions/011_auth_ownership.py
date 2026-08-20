"""Add users, sessions, and per-user ownership.

Revision ID: 011_auth_ownership
Revises: 010_schedule_entries
Create Date: 2026-08-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "011_auth_ownership"
down_revision: Union[str, None] = "010_schedule_entries"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

BOOTSTRAP_USER_ID = "b0000000-0000-4000-8000-000000000001"
BOOTSTRAP_EMAIL = "bootstrap@invalid.local"
UNUSABLE_PASSWORD_HASH = "!"


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("display_name", sa.String(length=80), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("timezone", sa.String(length=50), nullable=False, server_default="UTC"),
        sa.Column("is_bootstrap", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("uq_users_email_lower", "users", [sa.text("lower(email)")], unique=True)

    op.create_table(
        "user_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("csrf_token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash", name="uq_user_sessions_token_hash"),
    )
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])
    op.create_index("ix_user_sessions_token_hash", "user_sessions", ["token_hash"])

    op.execute(
        f"""
        INSERT INTO users (id, email, display_name, password_hash, timezone, is_bootstrap)
        VALUES (
            '{BOOTSTRAP_USER_ID}'::uuid,
            '{BOOTSTRAP_EMAIL}',
            'Bootstrap',
            '{UNUSABLE_PASSWORD_HASH}',
            'UTC',
            true
        )
        """
    )

    op.add_column("boards", sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("notes", sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("schedule_entries", sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True))

    op.execute(f"UPDATE boards SET user_id = '{BOOTSTRAP_USER_ID}'::uuid")
    op.execute(f"UPDATE notes SET user_id = '{BOOTSTRAP_USER_ID}'::uuid")
    op.execute(f"UPDATE schedule_entries SET user_id = '{BOOTSTRAP_USER_ID}'::uuid")

    op.alter_column("boards", "user_id", nullable=False)
    op.alter_column("notes", "user_id", nullable=False)
    op.alter_column("schedule_entries", "user_id", nullable=False)

    op.create_foreign_key(
        "fk_boards_user_id",
        "boards",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_notes_user_id",
        "notes",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_schedule_entries_user_id",
        "schedule_entries",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_boards_user_id", "boards", ["user_id"])
    op.create_index("ix_notes_user_id", "notes", ["user_id"])
    op.create_index("ix_schedule_entries_user_id", "schedule_entries", ["user_id"])

    op.drop_constraint("uq_boards_position", "boards", type_="unique")
    op.drop_index("uq_boards_lower_name", table_name="boards")
    op.create_unique_constraint("uq_boards_user_position", "boards", ["user_id", "position"])
    op.create_index(
        "uq_boards_user_lower_name",
        "boards",
        ["user_id", sa.text("lower(name)")],
        unique=True,
    )

    op.drop_index("ix_notes_pinned_updated", table_name="notes")
    op.create_index(
        "ix_notes_user_pinned_updated",
        "notes",
        ["user_id", "is_pinned", "updated_at"],
    )

    op.drop_index("ix_schedule_entries_kind_week", table_name="schedule_entries")
    op.create_index(
        "ix_schedule_entries_user_kind_week",
        "schedule_entries",
        ["user_id", "kind", "week_start"],
    )


def downgrade() -> None:
    op.drop_index("ix_schedule_entries_user_kind_week", table_name="schedule_entries")
    op.create_index("ix_schedule_entries_kind_week", "schedule_entries", ["kind", "week_start"])

    op.drop_index("ix_notes_user_pinned_updated", table_name="notes")
    op.create_index("ix_notes_pinned_updated", "notes", ["is_pinned", "updated_at"])

    op.drop_index("uq_boards_user_lower_name", table_name="boards")
    op.drop_constraint("uq_boards_user_position", "boards", type_="unique")
    op.create_index("uq_boards_lower_name", "boards", [sa.text("lower(name)")], unique=True)
    op.create_unique_constraint("uq_boards_position", "boards", ["position"])

    op.drop_index("ix_schedule_entries_user_id", table_name="schedule_entries")
    op.drop_index("ix_notes_user_id", table_name="notes")
    op.drop_index("ix_boards_user_id", table_name="boards")
    op.drop_constraint("fk_schedule_entries_user_id", "schedule_entries", type_="foreignkey")
    op.drop_constraint("fk_notes_user_id", "notes", type_="foreignkey")
    op.drop_constraint("fk_boards_user_id", "boards", type_="foreignkey")
    op.drop_column("schedule_entries", "user_id")
    op.drop_column("notes", "user_id")
    op.drop_column("boards", "user_id")

    op.drop_index("ix_user_sessions_token_hash", table_name="user_sessions")
    op.drop_index("ix_user_sessions_user_id", table_name="user_sessions")
    op.drop_table("user_sessions")
    op.drop_index("uq_users_email_lower", table_name="users")
    op.drop_table("users")
