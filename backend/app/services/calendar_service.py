from __future__ import annotations

import uuid
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import case, select
from sqlalchemy.orm import Session

from app.models import Board, BoardColumn, Task
from app.schemas.calendar import CalendarTask, CalendarTaskList
from app.services.ownership import board_access, get_board_for_user

# A six-week month grid is 42 days; 62 leaves room for any month view plus padding while keeping
# a single request small. Longer periods should be paged by the client.
CALENDAR_MAX_RANGE_DAYS = 62
CALENDAR_DEFAULT_LIMIT = 500
CALENDAR_MAX_LIMIT = 1000


def validate_range(start_date: date, end_date: date) -> None:
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_date must be on or after start_date",
        )
    # Inclusive range: 2026-01-01..2026-01-01 is one day.
    if (end_date - start_date).days + 1 > CALENDAR_MAX_RANGE_DAYS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Date range cannot exceed {CALENDAR_MAX_RANGE_DAYS} days",
        )


def list_calendar_tasks(
    db: Session,
    user_id: uuid.UUID,
    *,
    start_date: date,
    end_date: date,
    board_id: uuid.UUID | None = None,
    limit: int = CALENDAR_DEFAULT_LIMIT,
) -> CalendarTaskList:
    """Top-level tasks due within ``start_date``..``end_date`` (inclusive) on active boards the user
    owns or is a member of. The date range is filtered in SQL; archived boards and statuses are left
    out. Repeating tasks are generated for the range first, as the board view does."""
    validate_range(start_date, end_date)
    safe_limit = min(max(limit, 1), CALENDAR_MAX_LIMIT)
    if board_id is not None:
        # 404 for boards the user cannot see, rather than an empty calendar that hides the mistake.
        get_board_for_user(db, user_id, board_id)

    query = (
        select(Task, Board, BoardColumn)
        .join(BoardColumn, BoardColumn.id == Task.column_id)
        .join(Board, Board.id == BoardColumn.board_id)
        .where(
            board_access(user_id),
            Board.archived_at.is_(None),
            BoardColumn.archived_at.is_(None),
            Task.parent_task_id.is_(None),
            Task.due_date >= start_date,
            Task.due_date <= end_date,
        )
        .order_by(
            Task.due_date,
            case((Task.priority == "high", 0), (Task.priority == "medium", 1), else_=2),
            Task.title,
            Task.id,
        )
        .limit(safe_limit + 1)
    )
    if board_id is not None:
        query = query.where(Board.id == board_id)
    rows = db.execute(query).all()
    items = [
        CalendarTask(
            id=task.id,
            title=task.title,
            start_date=task.start_date,
            due_date=task.due_date,
            is_done=column.is_done or task.completed_at is not None,
            priority=task.priority,
            board_id=board.id,
            board_name=board.name,
            board_color=board.color,
            status_id=column.id,
            status_name=column.name,
        )
        for task, board, column in rows[:safe_limit]
    ]
    return CalendarTaskList(
        start_date=start_date,
        end_date=end_date,
        items=items,
        truncated=len(rows) > safe_limit,
        limit=safe_limit,
    )
