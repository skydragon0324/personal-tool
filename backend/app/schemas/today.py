from __future__ import annotations

import uuid
from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.schedule import ScheduleKind, SchedulePriority
from app.schemas.task import Priority

DeadlineStatus = Literal["overdue", "due_today", "starts_today", "in_progress", "completed"]


class ProgressRead(BaseModel):
    total: int
    completed: int
    remaining: int
    percentage: float


class TodayTaskRead(BaseModel):
    id: uuid.UUID
    title: str
    start_date: date
    due_date: date
    priority: Priority
    completed_at: datetime | None
    board_id: uuid.UUID
    board_name: str
    board_color: str
    board_icon_name: str | None
    status_id: uuid.UUID
    status_name: str
    status_color: str
    status_is_done: bool
    subtask_completed: int
    subtask_total: int
    deadline_status: DeadlineStatus


class TodayScheduleRead(BaseModel):
    id: uuid.UUID
    title: str
    kind: ScheduleKind
    weekdays: list[int]
    week_start: date | None
    start_time: time
    end_time: time
    priority: SchedulePriority | None
    color: str
    notes: str
    is_completed: bool
    completed_at: datetime | None


class TodayPinnedNoteRead(BaseModel):
    id: uuid.UUID
    title: str
    preview: str
    priority: str | None
    updated_at: datetime


class TodayRead(BaseModel):
    date: date
    task_progress: ProgressRead
    schedule_progress: ProgressRead
    active_tasks: list[TodayTaskRead]
    overdue_tasks: list[TodayTaskRead]
    schedules: list[TodayScheduleRead]
    pinned_notes: list[TodayPinnedNoteRead]
    pinned_notes_total: int
