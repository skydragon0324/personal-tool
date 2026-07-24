from datetime import date, datetime, timezone
from enum import Enum
from typing import Optional

from sqlalchemy import Column, String
from sqlmodel import Field, SQLModel


class Priority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class Task(SQLModel, table=True):
    __tablename__ = "tasks"

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(min_length=1, max_length=200, index=True)
    description: Optional[str] = Field(default=None, max_length=2000)
    due_date: date = Field(index=True)
    priority: Priority = Field(
        default=Priority.medium,
        sa_column=Column(String(20), nullable=False, index=True),
    )
    completed: bool = Field(default=False, index=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
