"""Rename the default board to Life Management.

Revision ID: 007_rename_board_life_management
Revises: 006_column_position_and_subtasks
Create Date: 2026-08-19
"""

from typing import Sequence, Union

from alembic import op

revision: str = "007_rename_board_life_management"
down_revision: Union[str, None] = "006_column_position_and_subtasks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE boards SET name = 'Life Management' WHERE name = 'Daily Board'")


def downgrade() -> None:
    op.execute("UPDATE boards SET name = 'Daily Board' WHERE name = 'Life Management'")
