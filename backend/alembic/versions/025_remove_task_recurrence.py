"""Remove repeating (recurring) tasks.

Tasks that were created by a repeating series stay as ordinary one-off tasks; only the series rules
and the columns that linked tasks to them are removed. Routines now belong in Schedule.

The downgrade recreates the empty tables and columns (as they were after 019_task_assignees) so
older code can run again, but the deleted series rules cannot be brought back.

Revision ID: 025_remove_task_recurrence
Revises: 024_board_folders
Create Date: 2026-11-25
"""

import importlib.util
from pathlib import Path
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "025_remove_task_recurrence"
down_revision: Union[str, None] = "024_board_folders"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _recurrence_migration():
    """014_task_recurrence, loaded from its file (its name starts with a digit, so it can't be imported)."""
    path = Path(__file__).with_name("014_task_recurrence.py")
    spec = importlib.util.spec_from_file_location("_migration_014_task_recurrence", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def upgrade() -> None:
    # Same steps as 014's downgrade: unlink tasks from their series, then drop the series tables.
    # The task rows themselves are kept.
    _recurrence_migration().downgrade()


def downgrade() -> None:
    _recurrence_migration().upgrade()
    # 017_board_members and 019_task_assignees later replaced the series' single assignee with a list.
    op.add_column(
        "task_recurrence_series",
        sa.Column(
            "assignee_ids",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
    )
