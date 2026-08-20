import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.constants import BOARD_ICONS, CATEGORY_COLORS, DEFAULT_BOARD_COLOR, DEFAULT_BOARD_ICON
from app.schemas.task import TaskSummaryRead


class BoardColumnRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    color: str = "slate"
    icon_name: str | None = None
    position: int
    is_done: bool
    archived_at: datetime | None = None
    tasks: list[TaskSummaryRead]


class BoardSummary(BaseModel):
    total: int
    completed: int
    remaining: int


class BoardView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    color: str = "teal"
    icon_name: str | None = None
    timezone: str
    created_at: datetime
    updated_at: datetime
    start_date: str
    end_date: str
    date_field: str = "due_date"
    unbounded: bool = False
    truncated: bool = False
    task_limit: int = 500
    summary: BoardSummary
    columns: list[BoardColumnRead]


class BoardRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    color: str
    icon_name: str | None
    timezone: str
    position: int
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
    total_tasks: int = 0
    completed_tasks: int = 0
    status_count: int = 0
    attachment_count: int = 0


class BoardStatusSeed(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    color: str = "slate"
    icon_name: str | None = None
    is_done: bool = False
    position: int = Field(default=0, ge=0, le=19)

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


class BoardCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str = DEFAULT_BOARD_COLOR
    icon_name: str | None = DEFAULT_BOARD_ICON
    timezone: str = "UTC"
    statuses: list[BoardStatusSeed] | None = Field(default=None, max_length=20)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Board name is required")
        return cleaned

    @field_validator("color")
    @classmethod
    def _color(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if cleaned not in CATEGORY_COLORS:
            raise ValueError(f"Color must be one of: {', '.join(CATEGORY_COLORS)}")
        return cleaned

    @field_validator("icon_name")
    @classmethod
    def _icon(cls, value: str | None) -> str | None:
        if value is None:
            return DEFAULT_BOARD_ICON
        cleaned = value.strip().lower()
        if cleaned not in BOARD_ICONS:
            raise ValueError(f"Icon must be one of: {', '.join(BOARD_ICONS)}")
        return cleaned

    @field_validator("timezone")
    @classmethod
    def _timezone(cls, value: str) -> str:
        cleaned = value.strip() or "UTC"
        try:
            ZoneInfo(cleaned)
        except Exception as exc:
            raise ValueError("Timezone is not valid") from exc
        return cleaned

    @model_validator(mode="after")
    def _statuses(self) -> "BoardCreate":
        if self.statuses is None:
            return self
        if not (1 <= len(self.statuses) <= 20):
            raise ValueError("Provide between 1 and 20 statuses")
        names = [item.name.lower() for item in self.statuses]
        if len(names) != len(set(names)):
            raise ValueError("Status names must be unique")
        if not any(item.is_done for item in self.statuses):
            raise ValueError("At least one status must count as completed")
        return self


class BoardUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    color: str | None = None
    icon_name: str | None = None
    timezone: str | None = None

    @field_validator("name")
    @classmethod
    def _name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Board name is required")
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

    @field_validator("icon_name")
    @classmethod
    def _icon(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip().lower()
        if cleaned not in BOARD_ICONS:
            raise ValueError(f"Icon must be one of: {', '.join(BOARD_ICONS)}")
        return cleaned

    @field_validator("timezone")
    @classmethod
    def _timezone(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip() or "UTC"
        try:
            ZoneInfo(cleaned)
        except Exception as exc:
            raise ValueError("Timezone is not valid") from exc
        return cleaned


class BoardReorder(BaseModel):
    target_position: int = Field(ge=0)
