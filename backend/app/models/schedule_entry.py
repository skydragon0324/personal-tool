from __future__ import annotations

import uuid
from datetime import date, datetime, time

from sqlalchemy import CheckConstraint, Date, DateTime, Integer, String, Text, Time, func, text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ScheduleEntry(Base):
    __tablename__ = "schedule_entries"
    __table_args__ = (
        CheckConstraint("kind IN ('routine', 'this_week')", name="ck_schedule_kind"),
        CheckConstraint(
            "priority IS NULL OR priority IN ('low', 'medium', 'high')",
            name="ck_schedule_priority",
        ),
        CheckConstraint("end_time > start_time", name="ck_schedule_time_order"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    weekdays: Mapped[list[int]] = mapped_column(ARRAY(Integer), nullable=False)
    week_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    priority: Mapped[str | None] = mapped_column(String(10), nullable=True)
    color: Mapped[str] = mapped_column(String(32), nullable=False, default="teal")
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default=text("''"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
