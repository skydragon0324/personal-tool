"""Column-wide task positions, Review rename, and subtasks.

Revision ID: 006_column_position_and_subtasks
Revises: 005_column_status
Create Date: 2026-08-19
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "006_column_position_and_subtasks"
down_revision: Union[str, None] = "005_column_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE board_columns SET name = 'Review' WHERE name = '리뷰'")

    op.drop_constraint("uq_tasks_column_due_position", "tasks", type_="unique")
    op.drop_index("ix_tasks_column_due_position", table_name="tasks")

    op.execute(
        """
        WITH ordered AS (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY column_id
                    ORDER BY due_date ASC, position ASC, created_at ASC
                ) - 1 AS new_pos
            FROM tasks
        )
        UPDATE tasks AS t
        SET position = ordered.new_pos
        FROM ordered
        WHERE t.id = ordered.id
        """
    )

    op.create_unique_constraint(
        "uq_tasks_column_position",
        "tasks",
        ["column_id", "position"],
        deferrable=True,
        initially="DEFERRED",
    )
    op.create_index("ix_tasks_column_position", "tasks", ["column_id", "position"])

    op.create_table(
        "task_subtasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("is_completed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "task_id",
            "position",
            name="uq_task_subtasks_task_position",
            deferrable=True,
            initially="DEFERRED",
        ),
    )


def downgrade() -> None:
    op.drop_table("task_subtasks")
    op.drop_constraint("uq_tasks_column_position", "tasks", type_="unique")
    op.drop_index("ix_tasks_column_position", table_name="tasks")
    op.create_unique_constraint(
        "uq_tasks_column_due_position",
        "tasks",
        ["column_id", "due_date", "position"],
        deferrable=True,
        initially="DEFERRED",
    )
    op.create_index(
        "ix_tasks_column_due_position",
        "tasks",
        ["column_id", "due_date", "position"],
    )
    op.execute("UPDATE board_columns SET name = '리뷰' WHERE name = 'Review'")
