"""Add board color/icon/position/archive fields and rename the default board to Personal.

Revision ID: 008_multi_board
Revises: 007_rename_board_life_management
Create Date: 2026-08-19
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "008_multi_board"
down_revision: Union[str, None] = "007_rename_board_life_management"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "boards",
        sa.Column("color", sa.String(length=32), nullable=False, server_default="teal"),
    )
    op.add_column("boards", sa.Column("icon_name", sa.String(length=40), nullable=True))
    op.add_column(
        "boards",
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "boards",
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.execute(
        """
        UPDATE boards
        SET name = 'Personal'
        WHERE name IN ('Life Management', 'Daily Board')
        """
    )
    op.execute("UPDATE boards SET color = 'teal' WHERE color IS NULL OR color = ''")
    op.execute("UPDATE boards SET icon_name = 'home' WHERE icon_name IS NULL")
    op.execute(
        """
        WITH ranked AS (
            SELECT
                id,
                ROW_NUMBER() OVER (PARTITION BY lower(name) ORDER BY created_at, id) AS rn
            FROM boards
        )
        UPDATE boards
        SET name = boards.name || ' (' || substring(boards.id::text, 1, 8) || ')'
        FROM ranked
        WHERE boards.id = ranked.id
          AND ranked.rn > 1
        """
    )
    op.execute(
        """
        WITH ordered AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS pos
            FROM boards
        )
        UPDATE boards
        SET position = ordered.pos
        FROM ordered
        WHERE boards.id = ordered.id
        """
    )

    op.create_unique_constraint("uq_boards_position", "boards", ["position"])
    op.create_index("uq_boards_lower_name", "boards", [sa.text("lower(name)")], unique=True)
    op.alter_column("boards", "color", server_default=None)
    op.alter_column("boards", "position", server_default=None)


def downgrade() -> None:
    op.drop_index("uq_boards_lower_name", table_name="boards")
    op.drop_constraint("uq_boards_position", "boards", type_="unique")
    op.drop_column("boards", "archived_at")
    op.drop_column("boards", "position")
    op.drop_column("boards", "icon_name")
    op.drop_column("boards", "color")
    op.execute("UPDATE boards SET name = 'Life Management' WHERE name = 'Personal'")
