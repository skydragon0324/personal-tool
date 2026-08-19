import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.task import TaskSummaryRead


class BoardColumnRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    position: int
    is_done: bool
    tasks: list[TaskSummaryRead]


class BoardSummary(BaseModel):
    total: int
    completed: int
    remaining: int


class BoardView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    timezone: str
    created_at: datetime
    updated_at: datetime
    start_date: str
    end_date: str
    summary: BoardSummary
    columns: list[BoardColumnRead]
