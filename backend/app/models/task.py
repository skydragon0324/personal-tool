from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    Boolean,
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
    from app.models.task_recurrence import TaskRecurrenceSeries
    from app.models.user import User


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
        Index("ix_tasks_series_occurrence_date", "recurrence_series_id", "occurrence_date"),
        Index("ix_tasks_remind_at", "remind_at", postgresql_where=text("remind_at IS NOT NULL")),
        Index(
            "uq_tasks_series_original_occurrence",
            "recurrence_series_id",
            "original_occurrence_date",
            unique=True,
            postgresql_where=text("recurrence_series_id IS NOT NULL"),
        ),
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
    remind_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    recurrence_series_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("task_recurrence_series.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    occurrence_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    original_occurrence_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    occurrence_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_detached: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    parent_task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    # Order among the parent's sub-tasks (``position`` is the slot in the status column).
    subtask_position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    column: Mapped[BoardColumn] = relationship("BoardColumn", back_populates="tasks")
    category: Mapped[Category] = relationship("Category", back_populates="tasks")
    # Everyone assigned to the task, via task_assignees.
    assignees: Mapped[list[User]] = relationship(
        "User", secondary="task_assignees", lazy="selectin", order_by="User.display_name"
    )
    recurrence_series: Mapped[TaskRecurrenceSeries | None] = relationship(
        "TaskRecurrenceSeries", back_populates="occurrences"
    )
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
    # Sub-tasks are full tasks that belong to a parent task. They live in a status column like any
    # task (so they have a status and keep a slot in that column's ordering) but are left out of
    # every task list; they are reached through their parent. Only one level deep.
    parent: Mapped[Task | None] = relationship(
        "Task", remote_side="Task.id", back_populates="subtasks"
    )
    subtasks: Mapped[list[Task]] = relationship(
        "Task",
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="Task.subtask_position",
    )
