from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel


class DashboardPriorityCounts(BaseModel):
    high: int = 0
    medium: int = 0
    low: int = 0


class DashboardBoardStats(BaseModel):
    id: uuid.UUID
    name: str
    color: str
    icon_name: str | None
    total: int
    open: int
    completed: int
    completion_rate: float
    overdue: int
    due_today: int
    status_count: int


class DashboardAttentionItem(BaseModel):
    id: uuid.UUID
    title: str
    due_date: date
    priority: str
    board_id: uuid.UUID
    board_name: str
    status_id: uuid.UUID
    status_name: str


class DashboardAttention(BaseModel):
    overdue: list[DashboardAttentionItem]
    due_today: list[DashboardAttentionItem]


class DashboardSummary(BaseModel):
    today: date
    active_boards: int
    total_tasks: int
    open_tasks: int
    completed_tasks: int
    completion_rate: float
    overdue: int
    due_today: int
    boards: list[DashboardBoardStats]
    priority: DashboardPriorityCounts
    attention: DashboardAttention
