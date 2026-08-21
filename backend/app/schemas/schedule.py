from __future__ import annotations

import uuid
from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.constants import CATEGORY_COLORS, DEFAULT_BOARD_COLOR

ScheduleKind = Literal["routine", "this_week"]
SchedulePriority = Literal["low", "medium", "high"]


def _require_monday(value: date) -> date:
    if value.weekday() != 0:
        raise ValueError("week_start must be a Monday")
    return value


class ScheduleEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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
    created_at: datetime
    updated_at: datetime


class ScheduleEntryCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    kind: ScheduleKind
    weekdays: list[int] = Field(min_length=1, max_length=7)
    week_start: date | None = None
    start_time: time
    end_time: time
    priority: SchedulePriority | None = None
    color: str = DEFAULT_BOARD_COLOR
    notes: str = ""

    @field_validator("title")
    @classmethod
    def _title(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Title is required")
        return cleaned

    @field_validator("weekdays")
    @classmethod
    def _weekdays(cls, value: list[int]) -> list[int]:
        unique = sorted({int(day) for day in value})
        if not unique or any(day < 0 or day > 6 for day in unique):
            raise ValueError("Weekdays must be unique values from 0 (Monday) to 6 (Sunday)")
        return unique

    @field_validator("week_start")
    @classmethod
    def _week_start(cls, value: date | None) -> date | None:
        if value is None:
            return value
        return _require_monday(value)

    @field_validator("color")
    @classmethod
    def _color(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if cleaned not in CATEGORY_COLORS:
            raise ValueError(f"Color must be one of: {', '.join(CATEGORY_COLORS)}")
        return cleaned

    @model_validator(mode="after")
    def _kind_and_time(self) -> "ScheduleEntryCreate":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be later than start_time")
        if self.kind == "this_week" and self.week_start is None:
            raise ValueError("week_start is required for this-week entries")
        if self.kind == "routine":
            self.week_start = None
        return self


class ScheduleEntryUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    kind: ScheduleKind | None = None
    weekdays: list[int] | None = Field(default=None, min_length=1, max_length=7)
    week_start: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    priority: SchedulePriority | None = None
    color: str | None = None
    notes: str | None = None

    @field_validator("title")
    @classmethod
    def _title(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Title is required")
        return cleaned

    @field_validator("weekdays")
    @classmethod
    def _weekdays(cls, value: list[int] | None) -> list[int] | None:
        if value is None:
            return value
        unique = sorted({int(day) for day in value})
        if not unique or any(day < 0 or day > 6 for day in unique):
            raise ValueError("Weekdays must be unique values from 0 (Monday) to 6 (Sunday)")
        return unique

    @field_validator("week_start")
    @classmethod
    def _week_start(cls, value: date | None) -> date | None:
        if value is None:
            return value
        return _require_monday(value)

    @field_validator("color")
    @classmethod
    def _color(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip().lower()
        if cleaned not in CATEGORY_COLORS:
            raise ValueError(f"Color must be one of: {', '.join(CATEGORY_COLORS)}")
        return cleaned


class ScheduleOccurrenceUpdate(BaseModel):
    is_completed: bool


class ScheduleOccurrenceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    schedule_entry_id: uuid.UUID
    occurrence_date: date
    is_completed: bool
    completed_at: datetime | None


class ScheduleWeekRead(BaseModel):
    week_start: date
    today: date
    entries: list[ScheduleEntryRead]
    occurrences: list[ScheduleOccurrenceRead]
