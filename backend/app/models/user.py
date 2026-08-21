from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Index, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.board import Board
    from app.models.inbox_item import InboxItem
    from app.models.note import Note
    from app.models.schedule_entry import ScheduleEntry
    from app.models.schedule_occurrence_state import ScheduleOccurrenceState
    from app.models.user_session import UserSession


class User(Base):
    __tablename__ = "users"
    __table_args__ = (Index("uq_users_email_lower", text("lower(email)"), unique=True),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), nullable=False, default="UTC")
    is_bootstrap: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    sessions: Mapped[list[UserSession]] = relationship(
        "UserSession",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    boards: Mapped[list[Board]] = relationship("Board", back_populates="user")
    notes: Mapped[list[Note]] = relationship("Note", back_populates="user")
    inbox_items: Mapped[list[InboxItem]] = relationship(
        "InboxItem",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    schedule_entries: Mapped[list[ScheduleEntry]] = relationship(
        "ScheduleEntry",
        back_populates="user",
    )
    schedule_occurrence_states: Mapped[list[ScheduleOccurrenceState]] = relationship(
        "ScheduleOccurrenceState",
        back_populates="user",
        cascade="all, delete-orphan",
    )
