from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel


class CalendarTask(BaseModel):
    """One task on the Calendar: enough to draw it on its due day and open or reschedule it."""

    id: uuid.UUID
    title: str
    start_date: date
    due_date: date
    is_done: bool
    priority: str
    board_id: uuid.UUID
    board_name: str
    board_color: str
    status_id: uuid.UUID
    status_name: str


class CalendarTaskList(BaseModel):
    start_date: date
    end_date: date
    items: list[CalendarTask]
    # The range holds more tasks than `limit`; only the first `limit` (soonest first) are returned.
    truncated: bool
    limit: int
