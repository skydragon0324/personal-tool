"""Allow several assignees per task.

Revision ID: 019_task_assignees
Revises: 018_task_overdue
Create Date: 2026-09-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "019_task_assignees"
down_revision: Union[str, None] = "018_task_overdue"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "task_assignees",
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_task_assignees_user_id", "task_assignees", ["user_id"])
    # Keep existing single assignments.
    op.execute(
        "INSERT INTO task_assignees (task_id, user_id) "
        "SELECT id, assignee_id FROM tasks WHERE assignee_id IS NOT NULL"
    )
    op.drop_index("ix_tasks_assignee_id", table_name="tasks")
    op.drop_column("tasks", "assignee_id")

    op.add_column(
        "task_recurrence_series",
        sa.Column(
            "assignee_ids",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
    )
    op.execute(
        "UPDATE task_recurrence_series SET assignee_ids = ARRAY[assignee_id] WHERE assignee_id IS NOT NULL"
    )
    op.drop_column("task_recurrence_series", "assignee_id")


def downgrade() -> None:
    op.add_column(
        "task_recurrence_series",
        sa.Column(
            "assignee_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.execute("UPDATE task_recurrence_series SET assignee_id = assignee_ids[1]")
    op.drop_column("task_recurrence_series", "assignee_ids")
    op.add_column(
        "tasks",
        sa.Column(
            "assignee_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_tasks_assignee_id", "tasks", ["assignee_id"])
    # Only one assignee survives a downgrade: the earliest.
    op.execute(
        "UPDATE tasks SET assignee_id = first.user_id FROM ("
        "  SELECT DISTINCT ON (task_id) task_id, user_id FROM task_assignees ORDER BY task_id, created_at"
        ") AS first WHERE first.task_id = tasks.id"
    )
    op.drop_index("ix_task_assignees_user_id", table_name="task_assignees")
    op.drop_table("task_assignees")
