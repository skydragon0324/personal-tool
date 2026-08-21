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
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.board import Board
    from app.models.board_column import BoardColumn
    from app.models.category import Category
    from app.models.task import Task
    from app.models.user import User


class TaskRecurrenceSeries(Base):
    __tablename__ = "task_recurrence_series"
    __table_args__ = (
        CheckConstraint("priority IN ('low', 'medium', 'high')", name="ck_task_recurrence_priority"),
        CheckConstraint("freq IN ('daily', 'weekly', 'monthly', 'yearly')", name="ck_task_recurrence_freq"),
        CheckConstraint("interval >= 1", name="ck_task_recurrence_interval"),
        CheckConstraint("duration_days >= 0", name="ck_task_recurrence_duration"),
        CheckConstraint(
            "month_day IS NULL OR (month_day >= 1 AND month_day <= 31)",
            name="ck_task_recurrence_month_day",
        ),
        CheckConstraint(
            "occurrence_limit IS NULL OR occurrence_limit >= 1",
            name="ck_task_recurrence_limit",
        ),
        CheckConstraint(
            "status IN ('active', 'stopped', 'archived')",
            name="ck_task_recurrence_status",
        ),
        Index("ix_task_recurrence_series_user_status", "user_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    board_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("boards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    default_column_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("board_columns.id", ondelete="SET NULL"), nullable=True
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    priority: Mapped[str] = mapped_column(String(10), nullable=False, default="medium")
    content: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    content_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_schema_version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default=text("1")
    )
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    timezone: Mapped[str] = mapped_column(String(50), nullable=False, default="UTC")
    freq: Mapped[str] = mapped_column(String(16), nullable=False)
    interval: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    weekdays: Mapped[list[int]] = mapped_column(ARRAY(Integer), nullable=False, default=list)
    month_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    until_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    occurrence_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    dtstart: Mapped[date] = mapped_column(Date, nullable=False)
    generated_through: Mapped[date | None] = mapped_column(Date, nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default=text("1"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped[User] = relationship("User", back_populates="task_recurrence_series")
    board: Mapped[Board] = relationship("Board")
    default_column: Mapped[BoardColumn | None] = relationship("BoardColumn")
    category: Mapped[Category] = relationship("Category")
    occurrences: Mapped[list[Task]] = relationship("Task", back_populates="recurrence_series")
    exceptions: Mapped[list[TaskRecurrenceException]] = relationship(
        "TaskRecurrenceException",
        back_populates="series",
        cascade="all, delete-orphan",
    )
    subtask_templates: Mapped[list[TaskRecurrenceSubtaskTemplate]] = relationship(
        "TaskRecurrenceSubtaskTemplate",
        back_populates="series",
        cascade="all, delete-orphan",
        order_by="TaskRecurrenceSubtaskTemplate.position",
    )
    link_templates: Mapped[list[TaskRecurrenceLinkTemplate]] = relationship(
        "TaskRecurrenceLinkTemplate",
        back_populates="series",
        cascade="all, delete-orphan",
        order_by="TaskRecurrenceLinkTemplate.position",
    )
    attachment_refs: Mapped[list[TaskRecurrenceAttachmentRef]] = relationship(
        "TaskRecurrenceAttachmentRef",
        back_populates="series",
        cascade="all, delete-orphan",
    )


class TaskRecurrenceException(Base):
    __tablename__ = "task_recurrence_exceptions"
    __table_args__ = (
        UniqueConstraint(
            "series_id",
            "original_occurrence_date",
            name="uq_task_recurrence_exception_date",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    series_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("task_recurrence_series.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    original_occurrence_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    series: Mapped[TaskRecurrenceSeries] = relationship(
        "TaskRecurrenceSeries", back_populates="exceptions"
    )


class TaskRecurrenceSubtaskTemplate(Base):
    __tablename__ = "task_recurrence_subtask_templates"
    __table_args__ = (
        UniqueConstraint("series_id", "position", name="uq_task_recurrence_subtask_pos"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    series_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("task_recurrence_series.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)

    series: Mapped[TaskRecurrenceSeries] = relationship(
        "TaskRecurrenceSeries", back_populates="subtask_templates"
    )


class TaskRecurrenceLinkTemplate(Base):
    __tablename__ = "task_recurrence_link_templates"
    __table_args__ = (
        UniqueConstraint("series_id", "position", name="uq_task_recurrence_link_pos"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    series_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("task_recurrence_series.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    url: Mapped[str] = mapped_column(String(2000), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)

    series: Mapped[TaskRecurrenceSeries] = relationship(
        "TaskRecurrenceSeries", back_populates="link_templates"
    )


class TaskRecurrenceAttachmentRef(Base):
    __tablename__ = "task_recurrence_attachment_refs"
    __table_args__ = (
        CheckConstraint(
            "attachment_kind IN ('image', 'file')",
            name="ck_task_recurrence_attachment_kind",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    series_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("task_recurrence_series.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(120), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    attachment_kind: Mapped[str] = mapped_column(String(20), nullable=False)

    series: Mapped[TaskRecurrenceSeries] = relationship(
        "TaskRecurrenceSeries", back_populates="attachment_refs"
    )
