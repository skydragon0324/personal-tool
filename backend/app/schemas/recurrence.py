from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

RecurrenceFreq = Literal["daily", "weekly", "monthly", "yearly"]
RecurrenceStatus = Literal["active", "stopped", "archived"]
EditScope = Literal["this", "this_and_future", "series"]
DeleteScope = Literal["this", "this_and_future", "series"]


class RecurrenceInput(BaseModel):
    freq: RecurrenceFreq
    interval: int = Field(default=1, ge=1, le=365)
    weekdays: list[int] = Field(default_factory=list)
    month_day: int | None = Field(default=None, ge=1, le=31)
    until_date: date | None = None
    occurrence_limit: int | None = Field(default=None, ge=1, le=999)

    @field_validator("weekdays")
    @classmethod
    def _weekdays(cls, value: list[int]) -> list[int]:
        unique = sorted({int(day) for day in value})
        if any(day < 0 or day > 6 for day in unique):
            raise ValueError("Weekdays must be values from 0 (Monday) to 6 (Sunday)")
        return unique

    @model_validator(mode="after")
    def _end_and_weekdays(self) -> "RecurrenceInput":
        if self.until_date is not None and self.occurrence_limit is not None:
            raise ValueError("Use either until_date or occurrence_limit, not both")
        if self.freq == "weekly" and not self.weekdays:
            raise ValueError("Weekly recurrence requires at least one weekday")
        return self


class RecurrenceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    series_id: uuid.UUID
    status: RecurrenceStatus
    freq: RecurrenceFreq
    interval: int
    weekdays: list[int]
    month_day: int | None
    until_date: date | None
    occurrence_limit: int | None
    occurrence_date: date | None = None
    original_occurrence_date: date | None = None
    is_detached: bool = False
    occurrence_index: int | None = None


class RecurrenceSeriesRead(BaseModel):
    id: uuid.UUID
    board_id: uuid.UUID
    default_column_id: uuid.UUID | None
    category_id: uuid.UUID
    title: str
    priority: str
    duration_days: int
    timezone: str
    freq: RecurrenceFreq
    interval: int
    weekdays: list[int]
    month_day: int | None
    until_date: date | None
    occurrence_limit: int | None
    status: RecurrenceStatus
    dtstart: date
    generated_through: date | None
    open_count: int
    completed_count: int


class RecurrenceGenerateRequest(BaseModel):
    start: date | None = None
    end: date | None = None

    @model_validator(mode="before")
    @classmethod
    def _from_to_aliases(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        payload = dict(data)
        if payload.get("start") is None and payload.get("from") is not None:
            payload["start"] = payload["from"]
        if payload.get("end") is None and payload.get("to") is not None:
            payload["end"] = payload["to"]
        return payload


class RecurrenceGenerateResult(BaseModel):
    created: int
    skipped: int


class RecurrenceStopResult(BaseModel):
    status: RecurrenceStatus
