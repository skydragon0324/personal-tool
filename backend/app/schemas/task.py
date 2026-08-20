from __future__ import annotations

import uuid
from datetime import date, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.category import CategorySummary
from app.services.url_validation import validate_http_url


class Priority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class TaskLinkInput(BaseModel):
    id: uuid.UUID | None = None
    label: str = Field(min_length=1, max_length=200)
    url: str = Field(min_length=1, max_length=2000)
    position: int = Field(ge=0)

    @field_validator("url")
    @classmethod
    def _url(cls, value: str) -> str:
        return validate_http_url(value)


class TaskLinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    label: str
    url: str
    position: int
    created_at: datetime


class TaskAttachmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    original_name: str
    content_type: str
    size_bytes: int
    attachment_kind: str
    created_at: datetime
    download_url: str | None = None


class SubtaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    task_id: uuid.UUID
    title: str
    is_completed: bool
    position: int
    created_at: datetime
    updated_at: datetime


class TaskSummaryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    column_id: uuid.UUID
    title: str
    due_date: date
    priority: Priority
    position: int
    version: int
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    content_preview: str
    checklist_completed: int
    checklist_total: int
    link_count: int
    attachment_count: int
    subtask_total: int = 0
    subtask_completed: int = 0
    category: CategorySummary


class TaskDetailRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    column_id: uuid.UUID
    title: str
    description: str | None
    content: dict[str, Any] | None
    content_text: str | None
    content_schema_version: int
    due_date: date
    priority: Priority
    position: int
    version: int
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    links: list[TaskLinkRead]
    attachments: list[TaskAttachmentRead]
    subtasks: list[SubtaskRead] = Field(default_factory=list)
    category: CategorySummary


class SubtaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)

    @field_validator("title")
    @classmethod
    def _title(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Subtask title is required")
        return cleaned


class SubtaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    is_completed: bool | None = None

    @field_validator("title")
    @classmethod
    def _title(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Subtask title is required")
        return cleaned


class SubtaskReorder(BaseModel):
    subtask_id: uuid.UUID
    before_subtask_id: uuid.UUID | None = None
    after_subtask_id: uuid.UUID | None = None


class TaskCreate(BaseModel):
    column_id: uuid.UUID
    category_id: uuid.UUID
    title: str = Field(min_length=1, max_length=160)
    description: str | None = None
    content: dict[str, Any] | None = None
    due_date: date
    priority: Priority = Priority.medium
    links: list[TaskLinkInput] = Field(default_factory=list)


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None
    content: dict[str, Any] | None = None
    due_date: date | None = None
    priority: Priority | None = None
    category_id: uuid.UUID | None = None
    links: list[TaskLinkInput] | None = None


class TaskMove(BaseModel):
    target_column_id: uuid.UUID
    expected_version: int = Field(ge=1)
    before_task_id: uuid.UUID | None = None
    after_task_id: uuid.UUID | None = None
    target_position: int | None = Field(default=None, ge=0)


# Back-compat alias used by older imports
TaskRead = TaskDetailRead
