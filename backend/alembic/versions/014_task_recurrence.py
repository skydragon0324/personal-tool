"""Add task recurrence series and occurrence identity.

Revision ID: 014_task_recurrence
Revises: 013_inbox_items
Create Date: 2026-08-21
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "014_task_recurrence"
down_revision: Union[str, None] = "013_inbox_items"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "task_recurrence_series",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("board_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("default_column_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("priority", sa.String(length=10), nullable=False, server_default="medium"),
        sa.Column("content", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("content_text", sa.Text(), nullable=True),
        sa.Column("content_schema_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("duration_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("timezone", sa.String(length=50), nullable=False, server_default="UTC"),
        sa.Column("freq", sa.String(length=16), nullable=False),
        sa.Column("interval", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("weekdays", postgresql.ARRAY(sa.Integer()), nullable=False, server_default="{}"),
        sa.Column("month_day", sa.Integer(), nullable=True),
        sa.Column("until_date", sa.Date(), nullable=True),
        sa.Column("occurrence_limit", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column("dtstart", sa.Date(), nullable=False),
        sa.Column("generated_through", sa.Date(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("priority IN ('low', 'medium', 'high')", name="ck_task_recurrence_priority"),
        sa.CheckConstraint("freq IN ('daily', 'weekly', 'monthly', 'yearly')", name="ck_task_recurrence_freq"),
        sa.CheckConstraint("interval >= 1", name="ck_task_recurrence_interval"),
        sa.CheckConstraint("duration_days >= 0", name="ck_task_recurrence_duration"),
        sa.CheckConstraint(
            "month_day IS NULL OR (month_day >= 1 AND month_day <= 31)",
            name="ck_task_recurrence_month_day",
        ),
        sa.CheckConstraint(
            "occurrence_limit IS NULL OR occurrence_limit >= 1",
            name="ck_task_recurrence_limit",
        ),
        sa.CheckConstraint(
            "status IN ('active', 'stopped', 'archived')",
            name="ck_task_recurrence_status",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["board_id"], ["boards.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["default_column_id"], ["board_columns.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_task_recurrence_series_user_id", "task_recurrence_series", ["user_id"])
    op.create_index("ix_task_recurrence_series_board_id", "task_recurrence_series", ["board_id"])
    op.create_index(
        "ix_task_recurrence_series_user_status",
        "task_recurrence_series",
        ["user_id", "status"],
    )

    op.create_table(
        "task_recurrence_exceptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("series_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("original_occurrence_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["series_id"], ["task_recurrence_series.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "series_id",
            "original_occurrence_date",
            name="uq_task_recurrence_exception_date",
        ),
    )
    op.create_index("ix_task_recurrence_exceptions_series_id", "task_recurrence_exceptions", ["series_id"])

    op.create_table(
        "task_recurrence_subtask_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("series_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["series_id"], ["task_recurrence_series.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("series_id", "position", name="uq_task_recurrence_subtask_pos"),
    )
    op.create_index(
        "ix_task_recurrence_subtask_templates_series_id",
        "task_recurrence_subtask_templates",
        ["series_id"],
    )

    op.create_table(
        "task_recurrence_link_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("series_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("label", sa.String(length=200), nullable=False),
        sa.Column("url", sa.String(length=2000), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["series_id"], ["task_recurrence_series.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("series_id", "position", name="uq_task_recurrence_link_pos"),
    )
    op.create_index(
        "ix_task_recurrence_link_templates_series_id",
        "task_recurrence_link_templates",
        ["series_id"],
    )

    op.create_table(
        "task_recurrence_attachment_refs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("series_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("attachment_kind", sa.String(length=20), nullable=False),
        sa.ForeignKeyConstraint(["series_id"], ["task_recurrence_series.id"], ondelete="CASCADE"),
        sa.CheckConstraint(
            "attachment_kind IN ('image', 'file')",
            name="ck_task_recurrence_attachment_kind",
        ),
    )
    op.create_index(
        "ix_task_recurrence_attachment_refs_series_id",
        "task_recurrence_attachment_refs",
        ["series_id"],
    )

    op.add_column("tasks", sa.Column("recurrence_series_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("tasks", sa.Column("occurrence_date", sa.Date(), nullable=True))
    op.add_column("tasks", sa.Column("original_occurrence_date", sa.Date(), nullable=True))
    op.add_column("tasks", sa.Column("occurrence_index", sa.Integer(), nullable=True))
    op.add_column(
        "tasks",
        sa.Column("is_detached", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_foreign_key(
        "fk_tasks_recurrence_series_id",
        "tasks",
        "task_recurrence_series",
        ["recurrence_series_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_tasks_recurrence_series_id", "tasks", ["recurrence_series_id"])
    op.create_index(
        "ix_tasks_series_occurrence_date",
        "tasks",
        ["recurrence_series_id", "occurrence_date"],
    )
    op.create_index(
        "uq_tasks_series_original_occurrence",
        "tasks",
        ["recurrence_series_id", "original_occurrence_date"],
        unique=True,
        postgresql_where=sa.text("recurrence_series_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_tasks_series_original_occurrence", table_name="tasks")
    op.drop_index("ix_tasks_series_occurrence_date", table_name="tasks")
    op.drop_index("ix_tasks_recurrence_series_id", table_name="tasks")
    op.drop_constraint("fk_tasks_recurrence_series_id", "tasks", type_="foreignkey")
    op.drop_column("tasks", "is_detached")
    op.drop_column("tasks", "occurrence_index")
    op.drop_column("tasks", "original_occurrence_date")
    op.drop_column("tasks", "occurrence_date")
    op.drop_column("tasks", "recurrence_series_id")
    op.drop_index("ix_task_recurrence_attachment_refs_series_id", table_name="task_recurrence_attachment_refs")
    op.drop_table("task_recurrence_attachment_refs")
    op.drop_index("ix_task_recurrence_link_templates_series_id", table_name="task_recurrence_link_templates")
    op.drop_table("task_recurrence_link_templates")
    op.drop_index(
        "ix_task_recurrence_subtask_templates_series_id",
        table_name="task_recurrence_subtask_templates",
    )
    op.drop_table("task_recurrence_subtask_templates")
    op.drop_index("ix_task_recurrence_exceptions_series_id", table_name="task_recurrence_exceptions")
    op.drop_table("task_recurrence_exceptions")
    op.drop_index("ix_task_recurrence_series_user_status", table_name="task_recurrence_series")
    op.drop_index("ix_task_recurrence_series_board_id", table_name="task_recurrence_series")
    op.drop_index("ix_task_recurrence_series_user_id", table_name="task_recurrence_series")
    op.drop_table("task_recurrence_series")
