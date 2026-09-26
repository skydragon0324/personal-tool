"""Share boards with teammates and assign tasks.

Revision ID: 017_board_members
Revises: 016_plans
Create Date: 2026-09-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "017_board_members"
down_revision: Union[str, None] = "016_plans"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD_KINDS = "kind IN ('daily_digest', 'schedule_start', 'task_reminder')"
NEW_KINDS = "kind IN ('daily_digest', 'schedule_start', 'task_reminder', 'board_shared', 'task_assigned')"


def upgrade() -> None:
    op.create_table(
        "board_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "board_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("boards.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "invited_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("board_id", "user_id", name="uq_board_members_board_user"),
    )
    op.create_index("ix_board_members_board_id", "board_members", ["board_id"])
    op.create_index("ix_board_members_user_id", "board_members", ["user_id"])

    op.create_table(
        "board_invitations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "board_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("boards.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column(
            "invited_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("board_id", "email", name="uq_board_invitations_board_email"),
    )
    op.create_index("ix_board_invitations_board_id", "board_invitations", ["board_id"])
    op.create_index("ix_board_invitations_email", "board_invitations", ["email"])

    op.add_column(
        "tasks",
        sa.Column(
            "assignee_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_tasks_assignee_id", "tasks", ["assignee_id"])
    op.add_column(
        "task_recurrence_series",
        sa.Column(
            "assignee_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    op.drop_constraint("ck_notifications_kind", "notifications", type_="check")
    op.create_check_constraint("ck_notifications_kind", "notifications", NEW_KINDS)


def downgrade() -> None:
    op.execute("DELETE FROM notifications WHERE kind IN ('board_shared', 'task_assigned')")
    op.drop_constraint("ck_notifications_kind", "notifications", type_="check")
    op.create_check_constraint("ck_notifications_kind", "notifications", OLD_KINDS)
    op.drop_column("task_recurrence_series", "assignee_id")
    op.drop_index("ix_tasks_assignee_id", table_name="tasks")
    op.drop_column("tasks", "assignee_id")
    op.drop_index("ix_board_invitations_email", table_name="board_invitations")
    op.drop_index("ix_board_invitations_board_id", table_name="board_invitations")
    op.drop_table("board_invitations")
    op.drop_index("ix_board_members_user_id", table_name="board_members")
    op.drop_index("ix_board_members_board_id", table_name="board_members")
    op.drop_table("board_members")
