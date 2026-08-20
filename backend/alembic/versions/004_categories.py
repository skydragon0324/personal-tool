"""Add board categories and task category_id.

Revision ID: 004_categories
Revises: 003_task_rich_content
Create Date: 2026-08-19
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "004_categories"
down_revision: Union[str, None] = "003_task_rich_content"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "board_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("boards.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("color", sa.String(length=32), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_categories_board_id", "categories", ["board_id"])
    op.create_index(
        "uq_categories_board_lower_name",
        "categories",
        ["board_id", sa.text("lower(name)")],
        unique=True,
    )

    op.add_column(
        "tasks",
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_tasks_category_id", "tasks", ["category_id"])
    op.create_foreign_key(
        "fk_tasks_category_id",
        "tasks",
        "categories",
        ["category_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.execute(
        """
        INSERT INTO categories (id, board_id, name, color, position)
        SELECT gen_random_uuid(), id, 'Uncategorized', 'gray', 0
        FROM boards
        """
    )
    op.execute(
        """
        UPDATE tasks AS t
        SET category_id = c.id
        FROM board_columns AS bc
        JOIN categories AS c
          ON c.board_id = bc.board_id
         AND lower(c.name) = 'uncategorized'
        WHERE t.column_id = bc.id
          AND t.category_id IS NULL
        """
    )
    op.alter_column("tasks", "category_id", nullable=False)


def downgrade() -> None:
    op.drop_constraint("fk_tasks_category_id", "tasks", type_="foreignkey")
    op.drop_index("ix_tasks_category_id", table_name="tasks")
    op.drop_column("tasks", "category_id")
    op.drop_index("uq_categories_board_lower_name", table_name="categories")
    op.drop_index("ix_categories_board_id", table_name="categories")
    op.drop_table("categories")
