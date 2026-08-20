from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.board_column import BoardColumn
    from app.models.category import Category
    from app.models.task_attachment import TaskAttachment
    from app.models.task_link import TaskLink
    from app.models.task_subtask import TaskSubtask


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint("priority IN ('low', 'medium', 'high')", name="ck_tasks_priority"),
        CheckConstraint("start_date <= due_date", name="ck_tasks_start_due"),
        UniqueConstraint(
            "column_id",
            "position",
            name="uq_tasks_column_position",
            deferrable=True,
            initially="DEFERRED",
        ),
        Index("ix_tasks_column_position", "column_id", "position"),
        Index("ix_tasks_due_priority", "due_date", "priority"),
        Index("ix_tasks_start_due", "start_date", "due_date"),
        Index("ix_tasks_content_text", "content_text"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    column_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("board_columns.id", ondelete="CASCADE"), nullable=False
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    content: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    content_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_schema_version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default=text("1")
    )
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    priority: Mapped[str] = mapped_column(String(10), nullable=False, default="medium")
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default=text("1"))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    column: Mapped[BoardColumn] = relationship("BoardColumn", back_populates="tasks")
    category: Mapped[Category] = relationship("Category", back_populates="tasks")
    links: Mapped[list[TaskLink]] = relationship(
        "TaskLink",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="TaskLink.position",
    )
    attachments: Mapped[list[TaskAttachment]] = relationship(
        "TaskAttachment",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="TaskAttachment.created_at",
    )
    subtasks: Mapped[list[TaskSubtask]] = relationship(
        "TaskSubtask",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="TaskSubtask.position",
    )
