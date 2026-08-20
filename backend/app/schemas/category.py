from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.constants import CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR


class CategorySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    color: str


class CategoryRead(CategorySummary):
    board_id: uuid.UUID
    position: int
    created_at: datetime


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    color: str = Field(default=DEFAULT_CATEGORY_COLOR, min_length=1, max_length=32)

    @field_validator("name")
    @classmethod
    def _trim_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Category name is required")
        return cleaned

    @field_validator("color")
    @classmethod
    def _color(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if cleaned not in CATEGORY_COLORS:
            raise ValueError(f"Color must be one of: {', '.join(CATEGORY_COLORS)}")
        return cleaned
