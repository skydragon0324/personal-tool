"""Add global notes table.

Revision ID: 009_notes
Revises: 008_multi_board
Create Date: 2026-08-19
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "009_notes"
down_revision: Union[str, None] = "008_multi_board"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column("priority", sa.String(length=10), nullable=True),
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "priority IS NULL OR priority IN ('low', 'medium', 'high')",
            name="ck_notes_priority",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notes_pinned_updated", "notes", ["is_pinned", "updated_at"])


def downgrade() -> None:
    op.drop_index("ix_notes_pinned_updated", table_name="notes")
    op.drop_table("notes")
