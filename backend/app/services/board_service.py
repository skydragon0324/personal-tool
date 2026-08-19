from __future__ import annotations

import uuid
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Board, BoardColumn, Task
from app.schemas.board import BoardColumnRead, BoardSummary, BoardView
from app.services.task_serializers import to_summary

MAX_RANGE_DAYS = 90


def resolve_date_range(
    *,
    start_date: date | None,
    end_date: date | None,
    legacy_date: date | None,
) -> tuple[date, date]:
    if start_date is not None or end_date is not None:
        if start_date is None or end_date is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Both start_date and end_date are required",
            )
        if end_date < start_date:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="end_date must be on or after start_date",
            )
        if (end_date - start_date).days > MAX_RANGE_DAYS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Date range cannot exceed {MAX_RANGE_DAYS} days",
            )
        return start_date, end_date

    day = legacy_date or date.today()
    return day, day


def get_board_view(
    db: Session,
    board_id: uuid.UUID,
    *,
    start_date: date | None = None,
    end_date: date | None = None,
    legacy_date: date | None = None,
) -> BoardView:
    range_start, range_end = resolve_date_range(
        start_date=start_date,
        end_date=end_date,
        legacy_date=legacy_date,
    )

    board = db.scalar(
        select(Board).where(Board.id == board_id).options(selectinload(Board.columns))
    )
    if board is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")

    columns = sorted(board.columns, key=lambda c: c.position)
    column_ids = [c.id for c in columns]

    tasks: list[Task] = []
    if column_ids:
        tasks = list(
            db.scalars(
                select(Task)
                .where(
                    Task.column_id.in_(column_ids),
                    Task.due_date >= range_start,
                    Task.due_date <= range_end,
                )
                .options(selectinload(Task.links), selectinload(Task.attachments))
                .order_by(Task.due_date, Task.position)
            ).all()
        )

    tasks_by_column: dict[uuid.UUID, list[Task]] = {cid: [] for cid in column_ids}
    for task in tasks:
        tasks_by_column.setdefault(task.column_id, []).append(task)

    done_column_ids = {c.id for c in columns if c.is_done}
    total = len(tasks)
    completed = sum(1 for t in tasks if t.column_id in done_column_ids)
    remaining = total - completed

    column_reads: list[BoardColumnRead] = []
    for column in columns:
        column_reads.append(
            BoardColumnRead(
                id=column.id,
                name=column.name,
                position=column.position,
                is_done=column.is_done,
                tasks=[to_summary(t) for t in tasks_by_column.get(column.id, [])],
            )
        )

    return BoardView(
        id=board.id,
        name=board.name,
        timezone=board.timezone,
        created_at=board.created_at,
        updated_at=board.updated_at,
        start_date=range_start.isoformat(),
        end_date=range_end.isoformat(),
        summary=BoardSummary(total=total, completed=completed, remaining=remaining),
        columns=column_reads,
    )


def get_column_or_404(db: Session, column_id: uuid.UUID) -> BoardColumn:
    column = db.get(BoardColumn, column_id)
    if column is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Column not found")
    return column
