from __future__ import annotations

import uuid
from datetime import datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

NotificationKind = Literal[
    "daily_digest", "schedule_start", "task_reminder", "board_shared", "task_assigned", "task_overdue"
]


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: NotificationKind
    title: str
    body: str
    board_id: uuid.UUID | None
    task_id: uuid.UUID | None
    schedule_entry_id: uuid.UUID | None
    fire_at: datetime
    read_at: datetime | None
    created_at: datetime


class NotificationFeed(BaseModel):
    items: list[NotificationRead]
    unread_count: int
    server_time: datetime


class NotificationPreferencesRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    digest_enabled: bool
    digest_time: time
    schedule_enabled: bool
    schedule_lead_minutes: int
    task_reminders_enabled: bool
    overdue_enabled: bool
    quiet_hours_enabled: bool
    quiet_start: time
    quiet_end: time


class NotificationPreferencesUpdate(BaseModel):
    digest_enabled: bool | None = None
    digest_time: time | None = None
    schedule_enabled: bool | None = None
    schedule_lead_minutes: int | None = Field(default=None, ge=0, le=240)
    task_reminders_enabled: bool | None = None
    overdue_enabled: bool | None = None
    quiet_hours_enabled: bool | None = None
    quiet_start: time | None = None
    quiet_end: time | None = None


class NotificationSnooze(BaseModel):
    """Remind about the notification's task again at this time (must include an offset)."""

    remind_at: datetime

    @field_validator("remind_at")
    @classmethod
    def _aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("remind_at must include a timezone offset")
        return value
