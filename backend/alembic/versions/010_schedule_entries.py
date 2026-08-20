"""Add schedule entries.

Revision ID: 010_schedule_entries
Revises: 009_notes
Create Date: 2026-08-19
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "010_schedule_entries"
down_revision: Union[str, None] = "009_notes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "schedule_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("weekdays", postgresql.ARRAY(sa.Integer()), nullable=False),
        sa.Column("week_start", sa.Date(), nullable=True),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("priority", sa.String(length=10), nullable=True),
        sa.Column("color", sa.String(length=32), nullable=False, server_default="teal"),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("kind IN ('routine', 'this_week')", name="ck_schedule_kind"),
        sa.CheckConstraint(
            "priority IS NULL OR priority IN ('low', 'medium', 'high')",
            name="ck_schedule_priority",
        ),
        sa.CheckConstraint("end_time > start_time", name="ck_schedule_time_order"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_schedule_entries_kind_week", "schedule_entries", ["kind", "week_start"])


def downgrade() -> None:
    op.drop_index("ix_schedule_entries_kind_week", table_name="schedule_entries")
    op.drop_table("schedule_entries")
