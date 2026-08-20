"""Add column color, icon, and archive fields.

Revision ID: 005_column_status
Revises: 004_categories
Create Date: 2026-08-19
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "005_column_status"
down_revision: Union[str, None] = "004_categories"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "board_columns",
        sa.Column("color", sa.String(length=32), nullable=False, server_default="slate"),
    )
    op.add_column(
        "board_columns",
        sa.Column("icon_name", sa.String(length=40), nullable=True),
    )
    op.add_column(
        "board_columns",
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        """
        UPDATE board_columns
        SET color = CASE
            WHEN is_done THEN 'teal'
            WHEN position = 1 THEN 'blue'
            ELSE 'slate'
        END
        """
    )
    op.execute(
        """
        UPDATE board_columns
        SET icon_name = CASE
            WHEN is_done THEN 'check'
            WHEN position = 1 THEN 'progress'
            ELSE 'circle'
        END
        """
    )


def downgrade() -> None:
    op.drop_column("board_columns", "archived_at")
    op.drop_column("board_columns", "icon_name")
    op.drop_column("board_columns", "color")
