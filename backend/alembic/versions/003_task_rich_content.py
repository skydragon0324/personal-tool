"""Add task content JSON, links, and attachments.

Revision ID: 003_task_rich_content
Revises: 002_kanban_boards
Create Date: 2026-07-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003_task_rich_content"
down_revision: Union[str, None] = "002_kanban_boards"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("content", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("tasks", sa.Column("content_text", sa.Text(), nullable=True))
    op.add_column(
        "tasks",
        sa.Column("content_schema_version", sa.Integer(), server_default="1", nullable=False),
    )
    op.create_index("ix_tasks_content_text", "tasks", ["content_text"])

    op.create_table(
        "task_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("label", sa.String(length=200), nullable=False),
        sa.Column("url", sa.String(length=2000), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("task_id", "position", name="uq_task_links_task_position"),
    )
    op.create_index("ix_task_links_task_id", "task_links", ["task_id"])

    op.create_table(
        "task_attachments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("attachment_kind", sa.String(length=20), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "attachment_kind IN ('image', 'file')",
            name="ck_task_attachments_kind",
        ),
        sa.UniqueConstraint("storage_key", name="uq_task_attachments_storage_key"),
    )
    op.create_index("ix_task_attachments_task_id", "task_attachments", ["task_id"])


def downgrade() -> None:
    op.drop_index("ix_task_attachments_task_id", table_name="task_attachments")
    op.drop_table("task_attachments")
    op.drop_index("ix_task_links_task_id", table_name="task_links")
    op.drop_table("task_links")
    op.drop_index("ix_tasks_content_text", table_name="tasks")
    op.drop_column("tasks", "content_schema_version")
    op.drop_column("tasks", "content_text")
    op.drop_column("tasks", "content")
