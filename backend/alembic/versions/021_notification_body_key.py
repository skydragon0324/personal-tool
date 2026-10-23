"""Store a message key and values with each notification so clients can translate its text.

Revision ID: 021_notification_body_key
Revises: 020_subtasks_as_tasks
Create Date: 2026-10-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "021_notification_body_key"
down_revision: Union[str, None] = "020_subtasks_as_tasks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing notifications keep only their English text; clients fall back to it.
    op.add_column("notifications", sa.Column("body_key", sa.String(length=64), nullable=True))
    op.add_column("notifications", sa.Column("body_params", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("notifications", "body_params")
    op.drop_column("notifications", "body_key")
