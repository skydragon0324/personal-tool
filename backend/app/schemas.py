from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models import Priority


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    due_date: date
    priority: Priority = Priority.medium
    completed: bool = False


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    due_date: Optional[date] = None
    priority: Optional[Priority] = None
    completed: Optional[bool] = None


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str]
    due_date: date
    priority: Priority
    completed: bool
    created_at: datetime


class DashboardSummary(BaseModel):
    total_today: int
    completed_today: int
    remaining_today: int
