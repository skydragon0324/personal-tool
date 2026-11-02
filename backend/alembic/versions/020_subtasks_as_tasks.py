"""Make sub-tasks full tasks that belong to a parent task.

Each existing one-line sub-task becomes a task (same id) under its parent: same category and
dates as the parent, medium priority. Completed ones go to the board's first done status, open
ones stay in the parent's status (or the board's first open status when the parent is done).
Sub-tasks keep a slot at the end of their status column so column ordering stays dense.

Revision ID: 020_subtasks_as_tasks
Revises: 019_task_assignees
Create Date: 2026-10-21
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "020_subtasks_as_tasks"
down_revision: Union[str, None] = "019_task_assignees"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column(
            "parent_task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.add_column("tasks", sa.Column("subtask_position", sa.Integer(), nullable=True))
    op.create_index("ix_tasks_parent_task_id", "tasks", ["parent_task_id"])

    op.execute(
        """
        WITH src AS (
            SELECT s.id, s.task_id, s.title, s.is_completed, s.position, s.created_at, s.updated_at,
                   t.column_id AS parent_column_id, t.category_id, t.start_date, t.due_date,
                   c.board_id, c.is_done AS parent_done, c.archived_at AS parent_archived
            FROM task_subtasks s
            JOIN tasks t ON t.id = s.task_id
            JOIN board_columns c ON c.id = t.column_id
        ),
        placed AS (
            SELECT src.*,
                   COALESCE(
                       CASE
                           WHEN src.is_completed THEN (
                               SELECT bc.id FROM board_columns bc
                               WHERE bc.board_id = src.board_id AND bc.is_done
                                 AND bc.archived_at IS NULL
                               ORDER BY bc.position LIMIT 1
                           )
                           WHEN NOT src.parent_done AND src.parent_archived IS NULL
                               THEN src.parent_column_id
                           ELSE (
                               SELECT bc.id FROM board_columns bc
                               WHERE bc.board_id = src.board_id AND NOT bc.is_done
                                 AND bc.archived_at IS NULL
                               ORDER BY bc.position LIMIT 1
                           )
                       END,
                       src.parent_column_id
                   ) AS target_column_id
            FROM src
        )
        INSERT INTO tasks (
            id, column_id, category_id, title, start_date, due_date, priority, position, version,
            completed_at, content_schema_version, is_detached, parent_task_id, subtask_position,
            created_at, updated_at
        )
        SELECT p.id, p.target_column_id, p.category_id, LEFT(p.title, 160), p.start_date,
               p.due_date, 'medium',
               (SELECT COALESCE(MAX(x.position), -1) FROM tasks x WHERE x.column_id = p.target_column_id)
                   + ROW_NUMBER() OVER (PARTITION BY p.target_column_id ORDER BY p.task_id, p.position),
               1, CASE WHEN p.is_completed THEN p.updated_at END, 1, false, p.task_id, p.position,
               p.created_at, p.updated_at
        FROM placed p
        """
    )
    op.drop_table("task_subtasks")


def downgrade() -> None:
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
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint(
            "task_id",
            "position",
            name="uq_task_subtasks_task_position",
            deferrable=True,
            initially="DEFERRED",
        ),
    )
    # Only the title and done state survive; everything else on a sub-task is dropped.
    op.execute(
        """
        INSERT INTO task_subtasks (id, task_id, title, is_completed, position, created_at, updated_at)
        SELECT id, parent_task_id, title, completed_at IS NOT NULL,
               ROW_NUMBER() OVER (PARTITION BY parent_task_id ORDER BY subtask_position, created_at) - 1,
               created_at, updated_at
        FROM tasks WHERE parent_task_id IS NOT NULL
        """
    )
    op.execute("DELETE FROM tasks WHERE parent_task_id IS NOT NULL")
    # Close the gaps the removed sub-tasks left in their columns.
    op.execute(
        """
        UPDATE tasks SET position = ranked.rn
        FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY column_id ORDER BY position, id) - 1 AS rn
            FROM tasks
        ) AS ranked
        WHERE ranked.id = tasks.id AND tasks.position <> ranked.rn
        """
    )
    op.drop_index("ix_tasks_parent_task_id", table_name="tasks")
    op.drop_column("tasks", "subtask_position")
    op.drop_column("tasks", "parent_task_id")
