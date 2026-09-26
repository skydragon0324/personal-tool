"""Overdue-task notifications.

Revision ID: 018_task_overdue
Revises: 017_board_members
Create Date: 2026-09-25
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "018_task_overdue"
down_revision: Union[str, None] = "017_board_members"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD_KINDS = "kind IN ('daily_digest', 'schedule_start', 'task_reminder', 'board_shared', 'task_assigned')"
NEW_KINDS = (
    "kind IN ('daily_digest', 'schedule_start', 'task_reminder', 'board_shared', 'task_assigned', "
    "'task_overdue')"
)


def upgrade() -> None:
    op.drop_constraint("ck_notifications_kind", "notifications", type_="check")
    op.create_check_constraint("ck_notifications_kind", "notifications", NEW_KINDS)
    op.add_column(
        "notification_preferences",
        sa.Column("overdue_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )


def downgrade() -> None:
    op.drop_column("notification_preferences", "overdue_enabled")
    op.execute("DELETE FROM notifications WHERE kind = 'task_overdue'")
    op.drop_constraint("ck_notifications_kind", "notifications", type_="check")
    op.create_check_constraint("ck_notifications_kind", "notifications", OLD_KINDS)
