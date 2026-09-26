from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _required(value: str | None, label: str) -> str | None:
    if value is None:
        return value
    cleaned = value.strip()
    if not cleaned:
        raise ValueError(f"{label} is required")
    return cleaned


class PlanItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    day_id: uuid.UUID
    title: str
    is_completed: bool
    completed_at: datetime | None
    position: int
    created_at: datetime
    updated_at: datetime


class PlanDayRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    plan_id: uuid.UUID
    day: date
    title: str
    items: list[PlanItemRead]
    created_at: datetime
    updated_at: datetime


class PlanRead(BaseModel):
    """List entry: plan metadata plus progress counts."""

    id: uuid.UUID
    name: str
    description: str
    position: int
    day_count: int
    item_count: int
    completed_count: int
    first_day: date | None
    last_day: date | None
    created_at: datetime
    updated_at: datetime


class PlanDetail(PlanRead):
    days: list[PlanDayRead]


class PlanCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        return _required(value, "Name") or ""


class PlanUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str | None) -> str | None:
        return _required(value, "Name")


class PlanDayCreate(BaseModel):
    day: date
    title: str = Field(default="", max_length=120)


class PlanDayUpdate(BaseModel):
    day: date | None = None
    title: str | None = Field(default=None, max_length=120)


class PlanItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)

    @field_validator("title")
    @classmethod
    def _title(cls, value: str) -> str:
        return _required(value, "Text") or ""


class PlanItemUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    is_completed: bool | None = None

    @field_validator("title")
    @classmethod
    def _title(cls, value: str | None) -> str | None:
        return _required(value, "Text")


PlanState = Literal["empty", "upcoming", "active", "finished"]


class PlanInsight(BaseModel):
    id: uuid.UUID
    name: str
    day_count: int
    item_count: int
    completed_count: int
    completion_rate: float
    first_day: date | None
    last_day: date | None
    # empty: no days yet · upcoming: starts later · active: today is within its days · finished: all days past
    state: PlanState
    days_done: int
    days_left: int
    missed_items: int
    next_day: date | None


class PlanTodayItem(BaseModel):
    id: uuid.UUID
    title: str
    is_completed: bool
    plan_id: uuid.UUID
    plan_name: str
    day_id: uuid.UUID


class PlanTimelinePoint(BaseModel):
    day: date
    planned: int
    completed: int


class PlanBehindDay(BaseModel):
    plan_id: uuid.UUID
    plan_name: str
    day_id: uuid.UUID
    day: date
    open_items: int
    total_items: int


class PlanOverviewTotals(BaseModel):
    plans: int
    active_plans: int
    days: int
    items: int
    completed: int
    completion_rate: float
    today_total: int
    today_completed: int
    missed_items: int


class PlanOverview(BaseModel):
    today: date
    totals: PlanOverviewTotals
    plans: list[PlanInsight]
    today_items: list[PlanTodayItem]
    timeline: list[PlanTimelinePoint]
    behind: list[PlanBehindDay]
