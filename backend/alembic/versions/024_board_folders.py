"""Folders that group a user's boards in the sidebar.

Revision ID: 024_board_folders
Revises: 023_login_id
Create Date: 2026-11-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "024_board_folders"
down_revision: Union[str, None] = "023_login_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "board_folders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_board_folders_user_id", "board_folders", ["user_id"])
    op.create_index(
        "uq_board_folders_user_lower_name",
        "board_folders",
        ["user_id", sa.text("lower(name)")],
        unique=True,
    )
    op.add_column("boards", sa.Column("folder_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_boards_folder_id", "boards", "board_folders", ["folder_id"], ["id"], ondelete="SET NULL"
    )
    op.create_index("ix_boards_folder_id", "boards", ["folder_id"])


def downgrade() -> None:
    op.drop_index("ix_boards_folder_id", table_name="boards")
    op.drop_constraint("fk_boards_folder_id", "boards", type_="foreignkey")
    op.drop_column("boards", "folder_id")
    op.drop_index("uq_board_folders_user_lower_name", table_name="board_folders")
    op.drop_index("ix_board_folders_user_id", table_name="board_folders")
    op.drop_table("board_folders")
