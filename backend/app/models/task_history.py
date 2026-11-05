from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TaskHistoryEntry(Base):
    """One change to a task: when, who, and which fields changed (see task_history_service)."""

    __tablename__ = "task_history"
    __table_args__ = (Index("ix_task_history_task_created", "task_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # The actor's name when the change was made, shown if the account is gone.
    actor_name: Mapped[str] = mapped_column(String(80), nullable=False)
    # "created" or "updated".
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    # [{"field": "status", "from": "To Do", "to": "Done"}, {"field": "assignees", "added": [...], "removed": [...]}]
    changes: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
        nullable=False,
    )
