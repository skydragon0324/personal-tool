from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.constants import CATEGORY_COLORS


class ColumnRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    board_id: uuid.UUID
    name: str
    color: str
    icon_name: str | None
    position: int
    is_done: bool
    archived_at: datetime | None
    created_at: datetime
    task_count: int = 0


class ColumnCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    color: str = "slate"
    icon_name: str | None = None
    is_done: bool = False

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Status name is required")
        return cleaned

    @field_validator("color")
    @classmethod
    def _color(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if cleaned not in CATEGORY_COLORS:
            raise ValueError(f"Color must be one of: {', '.join(CATEGORY_COLORS)}")
        return cleaned


class ColumnUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    color: str | None = None
    icon_name: str | None = None
    is_done: bool | None = None

    @field_validator("name")
    @classmethod
    def _name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Status name is required")
        return cleaned

    @field_validator("color")
    @classmethod
    def _color(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip().lower()
        if cleaned not in CATEGORY_COLORS:
            raise ValueError(f"Color must be one of: {', '.join(CATEGORY_COLORS)}")
        return cleaned


class ColumnReorder(BaseModel):
    target_position: int = Field(ge=0)


class ColumnArchive(BaseModel):
    move_to_column_id: uuid.UUID | None = None
