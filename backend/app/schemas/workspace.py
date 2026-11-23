from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _clean_required(value: str, message: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError(message)
    return cleaned


class BoardFolderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    position: int
    created_at: datetime
    updated_at: datetime


class BoardFolderWrite(BaseModel):
    name: str = Field(min_length=1, max_length=80)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        return _clean_required(value, "Folder name is required")


class InboxItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    details: str
    is_processed: bool
    processed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class InboxItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    details: str = Field(default="", max_length=5000)

    @field_validator("title")
    @classmethod
    def _title(cls, value: str) -> str:
        return _clean_required(value, "Inbox title is required")


class InboxItemUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    details: str | None = Field(default=None, max_length=5000)
    is_processed: bool | None = None

    @field_validator("title")
    @classmethod
    def _title(cls, value: str | None) -> str | None:
        return None if value is None else _clean_required(value, "Inbox title is required")
