"""Add personal inbox items.

Revision ID: 013_inbox_items
Revises: 012_today_and_task_period
Create Date: 2026-08-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "013_inbox_items"
down_revision: Union[str, None] = "012_today_and_task_period"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "inbox_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("details", sa.Text(), nullable=False, server_default=sa.text("''")),
        sa.Column("is_processed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_inbox_items_user_id", "inbox_items", ["user_id"])
    op.create_index(
        "ix_inbox_items_user_open_created",
        "inbox_items",
        ["user_id", "is_processed", "created_at"],
    )
    op.create_index(
        "ix_inbox_items_user_processed_at",
        "inbox_items",
        ["user_id", "processed_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_inbox_items_user_processed_at", table_name="inbox_items")
    op.drop_index("ix_inbox_items_user_open_created", table_name="inbox_items")
    op.drop_index("ix_inbox_items_user_id", table_name="inbox_items")
    op.drop_table("inbox_items")
