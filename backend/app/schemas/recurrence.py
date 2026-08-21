from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.services.url_validation import validate_http_url

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


class RecurrenceSeriesLinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    label: str
    url: str
    position: int


class RecurrenceSeriesLinkInput(BaseModel):
    id: uuid.UUID | None = None
    label: str = Field(min_length=1, max_length=200)
    url: str = Field(min_length=1, max_length=2000)
    position: int = Field(ge=0)

    @field_validator("url")
    @classmethod
    def _url(cls, value: str) -> str:
        return validate_http_url(value)


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
    next_occurrence_date: date | None = None
    open_count: int
    completed_count: int
    detached_count: int = 0
    version: int = 1
    content: dict[str, Any] | None = None
    content_schema_version: int = 1
    links: list[RecurrenceSeriesLinkRead] = Field(default_factory=list)


class RecurrenceSeriesUpdate(BaseModel):
    expected_version: int = Field(ge=1)
    title: str | None = Field(default=None, max_length=160)
    priority: Literal["low", "medium", "high"] | None = None
    content: dict[str, Any] | None = None
    category_id: uuid.UUID | None = None
    default_column_id: uuid.UUID | None = None
    duration_days: int | None = Field(default=None, ge=0)
    dtstart: date | None = None
    recurrence: RecurrenceInput | None = None
    links: list[RecurrenceSeriesLinkInput] | None = None

    @field_validator("title")
    @classmethod
    def _title(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Title is required")
        return cleaned

    @model_validator(mode="after")
    def _no_pause_via_null_recurrence(self) -> "RecurrenceSeriesUpdate":
        if "recurrence" in self.model_fields_set and self.recurrence is None:
            raise ValueError("Use the stop endpoint to pause a recurring series")
        if "title" in self.model_fields_set and self.title is None:
            raise ValueError("Title is required")
        if "priority" in self.model_fields_set and self.priority is None:
            raise ValueError("Priority is required")
        if "category_id" in self.model_fields_set and self.category_id is None:
            raise ValueError("Category is required")
        if "duration_days" in self.model_fields_set and self.duration_days is None:
            raise ValueError("duration_days is required")
        if "dtstart" in self.model_fields_set and self.dtstart is None:
            raise ValueError("dtstart is required")
        return self


class RecurrenceSeriesListItem(BaseModel):
    id: uuid.UUID
    board_id: uuid.UUID
    board_name: str
    board_archived: bool
    default_column_id: uuid.UUID | None
    default_column_name: str | None
    category_id: uuid.UUID
    category_name: str
    title: str
    priority: str
    timezone: str
    freq: RecurrenceFreq
    interval: int
    weekdays: list[int]
    month_day: int | None
    start_date: date
    end_date: date | None
    occurrence_limit: int | None
    status: RecurrenceStatus
    generated_through: date | None
    next_occurrence_date: date | None
    open_occurrence_count: int
    completed_occurrence_count: int
    detached_occurrence_count: int
    created_at: datetime
    updated_at: datetime


class RecurrenceSeriesListResponse(BaseModel):
    items: list[RecurrenceSeriesListItem]
    total: int
    offset: int
    limit: int


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
