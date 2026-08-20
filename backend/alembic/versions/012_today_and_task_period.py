"""Add task start_date and schedule occurrence completion.

Revision ID: 012_today_and_task_period
Revises: 011_auth_ownership
Create Date: 2026-08-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "012_today_and_task_period"
down_revision: Union[str, None] = "011_auth_ownership"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("start_date", sa.Date(), nullable=True))
    op.execute("UPDATE tasks SET start_date = LEAST(created_at::date, due_date)")
    op.alter_column("tasks", "start_date", nullable=False)
    op.create_check_constraint("ck_tasks_start_due", "tasks", "start_date <= due_date")
    op.create_index("ix_tasks_start_due", "tasks", ["start_date", "due_date"])

    op.create_table(
        "schedule_occurrence_states",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("schedule_entry_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("occurrence_date", sa.Date(), nullable=False),
        sa.Column("is_completed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["schedule_entry_id"], ["schedule_entries.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("schedule_entry_id", "occurrence_date", name="uq_schedule_occurrence_entry_date"),
    )
    op.create_index(
        "ix_schedule_occurrence_user_date",
        "schedule_occurrence_states",
        ["user_id", "occurrence_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_schedule_occurrence_user_date", table_name="schedule_occurrence_states")
    op.drop_table("schedule_occurrence_states")
    op.drop_index("ix_tasks_start_due", table_name="tasks")
    op.drop_constraint("ck_tasks_start_due", "tasks", type_="check")
    op.drop_column("tasks", "start_date")
