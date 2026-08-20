from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

NotePriority = Literal["low", "medium", "high"]


class NoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    body: str
    priority: NotePriority | None
    is_pinned: bool
    created_at: datetime
    updated_at: datetime


class NoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    body: str = ""
    priority: NotePriority | None = None
    is_pinned: bool = False

    @field_validator("title")
    @classmethod
    def _title(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Title is required")
        return cleaned


class NoteUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    body: str | None = None
    priority: NotePriority | None = None
    is_pinned: bool | None = None

    @field_validator("title")
    @classmethod
    def _title(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Title is required")
        return cleaned
