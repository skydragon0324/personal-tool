"""Add notifications, notification preferences and task reminders.

Revision ID: 015_notifications
Revises: 014_task_recurrence
Create Date: 2026-09-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "015_notifications"
down_revision: Union[str, None] = "014_task_recurrence"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("remind_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(
        "ix_tasks_remind_at",
        "tasks",
        ["remind_at"],
        postgresql_where=sa.text("remind_at IS NOT NULL"),
    )

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "board_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("boards.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "schedule_entry_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("schedule_entries.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("dedupe_key", sa.String(length=200), nullable=False),
        sa.Column("fire_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dismissed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "dedupe_key", name="uq_notifications_user_dedupe"),
        sa.CheckConstraint(
            "kind IN ('daily_digest', 'schedule_start', 'task_reminder')",
            name="ck_notifications_kind",
        ),
    )
    op.create_index("ix_notifications_user_fire", "notifications", ["user_id", "fire_at"])
    op.create_index("ix_notifications_task_id", "notifications", ["task_id"])
    op.create_index("ix_notifications_schedule_entry_id", "notifications", ["schedule_entry_id"])

    op.create_table(
        "notification_preferences",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("digest_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("digest_time", sa.Time(), nullable=False, server_default=sa.text("'08:00'")),
        sa.Column("schedule_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("schedule_lead_minutes", sa.Integer(), nullable=False, server_default=sa.text("10")),
        sa.Column("task_reminders_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("quiet_hours_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("quiet_start", sa.Time(), nullable=False, server_default=sa.text("'22:00'")),
        sa.Column("quiet_end", sa.Time(), nullable=False, server_default=sa.text("'07:00'")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "schedule_lead_minutes >= 0 AND schedule_lead_minutes <= 240",
            name="ck_notification_prefs_lead",
        ),
    )


def downgrade() -> None:
    op.drop_table("notification_preferences")
    op.drop_index("ix_notifications_schedule_entry_id", table_name="notifications")
    op.drop_index("ix_notifications_task_id", table_name="notifications")
    op.drop_index("ix_notifications_user_fire", table_name="notifications")
    op.drop_table("notifications")
    op.drop_index("ix_tasks_remind_at", table_name="tasks")
    op.drop_column("tasks", "remind_at")
