from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, time, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.constants import (
    DEFAULT_BOARD_COLUMNS,
    DEFAULT_BOARD_ICON,
    UNCATEGORIZED_COLOR,
    UNCATEGORIZED_NAME,
)
from app.models import Board, BoardColumn, Category, Task, TaskAttachment
from app.schemas.board import (
    BoardColumnRead,
    BoardCreate,
    BoardRead,
    BoardReorder,
    BoardSummary,
    BoardUpdate,
    BoardView,
)
from app.services.storage import get_storage
from app.services.task_serializers import to_summary

MAX_RANGE_DAYS = 3653  # 10 years, including leap days
DEFAULT_TASK_LIMIT = 500
DateField = Literal["due_date", "created_at"]


def resolve_date_range(
    *,
    start_date: date | None,
    end_date: date | None,
    legacy_date: date | None,
    unbounded: bool = False,
) -> tuple[date | None, date | None]:
    if unbounded:
        return None, None
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


def _created_at_window(start: date, end: date, timezone_name: str) -> tuple[datetime, datetime]:
    try:
        tz = ZoneInfo(timezone_name)
    except Exception:
        tz = ZoneInfo("UTC")
    start_dt = datetime.combine(start, time.min, tzinfo=tz)
    end_dt = datetime.combine(end + timedelta(days=1), time.min, tzinfo=tz)
    return start_dt, end_dt


def get_board_view(
    db: Session,
    board_id: uuid.UUID,
    *,
    start_date: date | None = None,
    end_date: date | None = None,
    legacy_date: date | None = None,
    date_field: DateField = "due_date",
    unbounded: bool = False,
    limit: int = DEFAULT_TASK_LIMIT,
) -> BoardView:
    if date_field not in ("due_date", "created_at"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date_field must be due_date or created_at",
        )
    safe_limit = min(max(limit, 1), DEFAULT_TASK_LIMIT)
    range_start, range_end = resolve_date_range(
        start_date=start_date,
        end_date=end_date,
        legacy_date=legacy_date,
        unbounded=unbounded,
    )

    board = db.scalar(
        select(Board).where(Board.id == board_id).options(selectinload(Board.columns))
    )
    if board is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")

    columns = sorted(
        [column for column in board.columns if column.archived_at is None],
        key=lambda c: c.position,
    )
    column_ids = [c.id for c in columns]

    tasks: list[Task] = []
    truncated = False
    if column_ids:
        query = (
            select(Task)
            .where(Task.column_id.in_(column_ids))
            .options(
                selectinload(Task.links),
                selectinload(Task.attachments),
                selectinload(Task.category),
                selectinload(Task.subtasks),
            )
            .order_by(Task.position)
        )
        if range_start is not None and range_end is not None:
            if date_field == "due_date":
                query = query.where(Task.due_date >= range_start, Task.due_date <= range_end)
            else:
                start_dt, end_dt = _created_at_window(range_start, range_end, board.timezone)
                query = query.where(Task.created_at >= start_dt, Task.created_at < end_dt)
        fetched = list(db.scalars(query.limit(safe_limit + 1)).all())
        truncated = len(fetched) > safe_limit
        tasks = fetched[:safe_limit]

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
                color=column.color,
                icon_name=column.icon_name,
                position=column.position,
                is_done=column.is_done,
                archived_at=column.archived_at,
                tasks=[to_summary(t) for t in tasks_by_column.get(column.id, [])],
            )
        )

    return BoardView(
        id=board.id,
        name=board.name,
        color=board.color,
        icon_name=board.icon_name,
        timezone=board.timezone,
        created_at=board.created_at,
        updated_at=board.updated_at,
        start_date=range_start.isoformat() if range_start else "",
        end_date=range_end.isoformat() if range_end else "",
        date_field=date_field,
        unbounded=unbounded,
        truncated=truncated,
        task_limit=safe_limit,
        summary=BoardSummary(total=total, completed=completed, remaining=remaining),
        columns=column_reads,
    )


def get_column_or_404(db: Session, column_id: uuid.UUID) -> BoardColumn:
    column = db.get(BoardColumn, column_id)
    if column is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Column not found")
    if column.archived_at is not None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Cannot place a task in an archived status")
    return column


def _unused_board_position(db: Session, *, start_from: int) -> int:
    used = {
        int(value)
        for value in db.scalars(select(Board.position)).all()
        if value is not None
    }
    position = start_from
    while position in used:
        position += 1
    return position


def _ensure_unique_name(db: Session, name: str, *, exclude_id: uuid.UUID | None = None) -> None:
    query = select(Board).where(func.lower(Board.name) == name.lower())
    if exclude_id is not None:
        query = query.where(Board.id != exclude_id)
    existing = db.scalar(query)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f'A board named "{existing.name}" already exists',
        )


def _task_counts(db: Session) -> dict[uuid.UUID, tuple[int, int]]:
    rows = db.execute(
        select(
            Board.id,
            func.count(Task.id),
            func.count(Task.id).filter(BoardColumn.is_done.is_(True)),
        )
        .select_from(Board)
        .outerjoin(BoardColumn, BoardColumn.board_id == Board.id)
        .outerjoin(Task, Task.column_id == BoardColumn.id)
        .group_by(Board.id)
    ).all()
    return {board_id: (int(total), int(completed)) for board_id, total, completed in rows}


def _status_counts(db: Session) -> dict[uuid.UUID, int]:
    rows = db.execute(
        select(Board.id, func.count(BoardColumn.id))
        .select_from(Board)
        .outerjoin(BoardColumn, BoardColumn.board_id == Board.id)
        .group_by(Board.id)
    ).all()
    return {board_id: int(count) for board_id, count in rows}


def _attachment_counts(db: Session) -> dict[uuid.UUID, int]:
    rows = db.execute(
        select(Board.id, func.count(TaskAttachment.id))
        .select_from(Board)
        .outerjoin(BoardColumn, BoardColumn.board_id == Board.id)
        .outerjoin(Task, Task.column_id == BoardColumn.id)
        .outerjoin(TaskAttachment, TaskAttachment.task_id == Task.id)
        .group_by(Board.id)
    ).all()
    return {board_id: int(count) for board_id, count in rows}


def _board_stats(
    db: Session,
) -> tuple[dict[uuid.UUID, tuple[int, int]], dict[uuid.UUID, int], dict[uuid.UUID, int]]:
    return _task_counts(db), _status_counts(db), _attachment_counts(db)


def _read_board(db: Session, board: Board) -> BoardRead:
    counts, statuses, attachments = _board_stats(db)
    return _to_read(board, counts, statuses, attachments)


def _to_read(
    board: Board,
    counts: dict[uuid.UUID, tuple[int, int]],
    status_counts: dict[uuid.UUID, int] | None = None,
    attachment_counts: dict[uuid.UUID, int] | None = None,
) -> BoardRead:
    total, completed = counts.get(board.id, (0, 0))
    return BoardRead(
        id=board.id,
        name=board.name,
        color=board.color,
        icon_name=board.icon_name,
        timezone=board.timezone,
        position=board.position,
        archived_at=board.archived_at,
        created_at=board.created_at,
        updated_at=board.updated_at,
        total_tasks=total,
        completed_tasks=completed,
        status_count=(status_counts or {}).get(board.id, 0),
        attachment_count=(attachment_counts or {}).get(board.id, 0),
    )


def list_boards(db: Session, *, include_archived: bool = True) -> list[BoardRead]:
    query = select(Board)
    if not include_archived:
        query = query.where(Board.archived_at.is_(None))
    boards = list(
        db.scalars(query.order_by(Board.archived_at.is_not(None), Board.position, Board.name)).all()
    )
    counts, statuses, attachments = _board_stats(db)
    return [_to_read(board, counts, statuses, attachments) for board in boards]


def get_board(db: Session, board_id: uuid.UUID) -> BoardRead:
    board = db.get(Board, board_id)
    if board is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    return _read_board(db, board)


def create_board(db: Session, payload: BoardCreate) -> BoardRead:
    _ensure_unique_name(db, payload.name)
    max_active = db.scalar(
        select(func.coalesce(func.max(Board.position), -1)).where(Board.archived_at.is_(None))
    )
    board = Board(
        name=payload.name,
        color=payload.color,
        icon_name=payload.icon_name or DEFAULT_BOARD_ICON,
        timezone=payload.timezone,
        position=_unused_board_position(db, start_from=int(max_active) + 1),
    )
    db.add(board)
    db.flush()

    if payload.statuses:
        seeds = sorted(payload.statuses, key=lambda item: item.position)
        for index, seed in enumerate(seeds):
            db.add(
                BoardColumn(
                    board_id=board.id,
                    name=seed.name,
                    color=seed.color,
                    icon_name=seed.icon_name,
                    is_done=seed.is_done,
                    position=index,
                )
            )
    else:
        for index, (name, color, is_done) in enumerate(DEFAULT_BOARD_COLUMNS):
            db.add(
                BoardColumn(
                    board_id=board.id,
                    name=name,
                    color=color,
                    is_done=is_done,
                    position=index,
                )
            )
    db.add(
        Category(
            board_id=board.id,
            name=UNCATEGORIZED_NAME,
            color=UNCATEGORIZED_COLOR,
            position=0,
        )
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f'A board named "{payload.name}" already exists',
        ) from None
    db.refresh(board)
    return _read_board(db, board)


def update_board(db: Session, board_id: uuid.UUID, payload: BoardUpdate) -> BoardRead:
    board = db.get(Board, board_id)
    if board is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        _ensure_unique_name(db, data["name"], exclude_id=board.id)
    for key, value in data.items():
        setattr(board, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A board with that name already exists",
        ) from None
    db.refresh(board)
    return _read_board(db, board)


def reorder_board(db: Session, board_id: uuid.UUID, payload: BoardReorder) -> BoardRead:
    board = db.get(Board, board_id)
    if board is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    if board.archived_at is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Archived boards cannot be reordered",
        )

    active = list(
        db.scalars(
            select(Board)
            .where(Board.archived_at.is_(None))
            .order_by(Board.position)
            .with_for_update()
        ).all()
    )
    old_index = next((i for i, item in enumerate(active) if item.id == board.id), None)
    if old_index is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    target = min(max(payload.target_position, 0), len(active) - 1)
    if target == old_index:
        return _read_board(db, board)

    active.pop(old_index)
    active.insert(target, board)
    for index, item in enumerate(active):
        item.position = -(index + 1)
    db.flush()
    used_archived = {
        int(value)
        for value in db.scalars(select(Board.position).where(Board.archived_at.is_not(None))).all()
        if value is not None
    }
    next_pos = 0
    for item in active:
        while next_pos in used_archived:
            next_pos += 1
        item.position = next_pos
        next_pos += 1
    db.commit()
    db.refresh(board)
    return _read_board(db, board)


def archive_board(db: Session, board_id: uuid.UUID) -> BoardRead:
    board = db.get(Board, board_id)
    if board is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    if board.archived_at is not None:
        return _read_board(db, board)

    remaining = db.scalar(
        select(func.count(Board.id)).where(Board.archived_at.is_(None), Board.id != board.id)
    )
    if int(remaining or 0) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The last active board cannot be archived",
        )

    board.position = -1
    db.flush()
    board.archived_at = datetime.now(UTC)
    max_pos = db.scalar(select(func.coalesce(func.max(Board.position), -1)).where(Board.id != board.id))
    board.position = _unused_board_position(db, start_from=max(1_000_000, int(max_pos) + 1))
    db.commit()
    db.refresh(board)
    return _read_board(db, board)


def restore_board(db: Session, board_id: uuid.UUID) -> BoardRead:
    board = db.get(Board, board_id)
    if board is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    if board.archived_at is None:
        return _read_board(db, board)

    max_active = db.scalar(
        select(func.coalesce(func.max(Board.position), -1)).where(Board.archived_at.is_(None))
    )
    board.position = -1
    db.flush()
    board.archived_at = None
    board.position = _unused_board_position(db, start_from=int(max_active) + 1)
    db.commit()
    db.refresh(board)
    return _read_board(db, board)


def delete_board(db: Session, board_id: uuid.UUID) -> None:
    board = db.get(Board, board_id)
    if board is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    if board.archived_at is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Active boards cannot be deleted. Archive the board first.",
        )

    storage_keys = list(
        db.scalars(
            select(TaskAttachment.storage_key)
            .join(Task, Task.id == TaskAttachment.task_id)
            .join(BoardColumn, BoardColumn.id == Task.column_id)
            .where(BoardColumn.board_id == board.id)
        ).all()
    )
    storage = get_storage()
    try:
        for key in storage_keys:
            storage.delete(key)
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not delete board files",
        ) from exc

    column_ids = list(db.scalars(select(BoardColumn.id).where(BoardColumn.board_id == board.id)).all())
    if column_ids:
        db.execute(delete(Task).where(Task.column_id.in_(column_ids)))
        db.flush()
    db.delete(board)
    db.commit()
