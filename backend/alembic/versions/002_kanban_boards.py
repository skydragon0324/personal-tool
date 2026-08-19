"""Replace flat tasks with boards/columns/tasks kanban schema.

Revision ID: 002_kanban_boards
Revises: 001_create_tasks
Create Date: 2026-07-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002_kanban_boards"
down_revision: Union[str, None] = "001_create_tasks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

BOARD_ID = "a0000000-0000-4000-8000-000000000001"
COL_TODO = "a0000000-0000-4000-8000-000000000011"
COL_DOING = "a0000000-0000-4000-8000-000000000012"
COL_DONE = "a0000000-0000-4000-8000-000000000013"


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS tasks CASCADE")

    op.create_table(
        "boards",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("timezone", sa.String(length=50), nullable=False, server_default="UTC"),
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
    )

    op.create_table(
        "board_columns",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "board_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("boards.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("is_done", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("board_id", "position", name="uq_board_columns_board_position"),
    )
    op.create_index("ix_board_columns_board_id", "board_columns", ["board_id"])

    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "column_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("board_columns.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("priority", sa.String(length=10), nullable=False, server_default="medium"),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.CheckConstraint("priority IN ('low', 'medium', 'high')", name="ck_tasks_priority"),
        sa.UniqueConstraint(
            "column_id",
            "due_date",
            "position",
            name="uq_tasks_column_due_position",
            deferrable=True,
            initially="DEFERRED",
        ),
    )
    op.create_index("ix_tasks_column_due_position", "tasks", ["column_id", "due_date", "position"])
    op.create_index("ix_tasks_due_priority", "tasks", ["due_date", "priority"])

    op.execute(
        f"""
        INSERT INTO boards (id, name, timezone)
        VALUES ('{BOARD_ID}'::uuid, 'Daily Board', 'America/New_York')
        """
    )
    op.execute(
        f"""
        INSERT INTO board_columns (id, board_id, name, position, is_done)
        VALUES
          ('{COL_TODO}'::uuid, '{BOARD_ID}'::uuid, 'To Do', 0, false),
          ('{COL_DOING}'::uuid, '{BOARD_ID}'::uuid, 'In Progress', 1, false),
          ('{COL_DONE}'::uuid, '{BOARD_ID}'::uuid, 'Done', 2, true)
        """
    )


def downgrade() -> None:
    op.drop_index("ix_tasks_due_priority", table_name="tasks")
    op.drop_index("ix_tasks_column_due_position", table_name="tasks")
    op.drop_table("tasks")
    op.drop_index("ix_board_columns_board_id", table_name="board_columns")
    op.drop_table("board_columns")
    op.drop_table("boards")

    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.String(length=2000), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("priority", sa.String(length=20), nullable=False),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_tasks_title", "tasks", ["title"])
    op.create_index("ix_tasks_due_date", "tasks", ["due_date"])
    op.create_index("ix_tasks_priority", "tasks", ["priority"])
    op.create_index("ix_tasks_completed", "tasks", ["completed"])
