from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models import BoardColumn, Task
from app.schemas.column import ColumnArchive, ColumnCreate, ColumnRead, ColumnReorder, ColumnUpdate
from app.services.category_service import get_board_or_404
from app.services.ownership import get_column_for_user


def _task_count(db: Session, column_id: uuid.UUID) -> int:
    return int(db.scalar(select(func.count(Task.id)).where(Task.column_id == column_id)) or 0)


def _to_read(db: Session, column: BoardColumn) -> ColumnRead:
    return ColumnRead(
        id=column.id,
        board_id=column.board_id,
        name=column.name,
        color=column.color,
        icon_name=column.icon_name,
        position=column.position,
        is_done=column.is_done,
        archived_at=column.archived_at,
        created_at=column.created_at,
        task_count=_task_count(db, column.id),
    )


def list_columns(
    db: Session,
    user_id: uuid.UUID,
    board_id: uuid.UUID,
    *,
    include_archived: bool = True,
) -> list[ColumnRead]:
    get_board_or_404(db, user_id, board_id)
    query = select(BoardColumn).where(BoardColumn.board_id == board_id)
    if not include_archived:
        query = query.where(BoardColumn.archived_at.is_(None))
    columns = list(db.scalars(query.order_by(BoardColumn.archived_at.is_not(None), BoardColumn.position)).all())
    return [_to_read(db, column) for column in columns]


def _unused_column_position(db: Session, board_id: uuid.UUID, *, start_from: int) -> int:
    used = {
        int(value)
        for value in db.scalars(
            select(BoardColumn.position).where(BoardColumn.board_id == board_id)
        ).all()
        if value is not None
    }
    position = start_from
    while position in used:
        position += 1
    return position


def create_column(db: Session, user_id: uuid.UUID, board_id: uuid.UUID, payload: ColumnCreate) -> ColumnRead:
    get_board_or_404(db, user_id, board_id)
    max_active = db.scalar(
        select(func.coalesce(func.max(BoardColumn.position), -1)).where(
            BoardColumn.board_id == board_id,
            BoardColumn.archived_at.is_(None),
        )
    )
    column = BoardColumn(
        board_id=board_id,
        name=payload.name,
        color=payload.color,
        icon_name=payload.icon_name,
        is_done=payload.is_done,
        position=_unused_column_position(db, board_id, start_from=int(max_active or -1) + 1),
    )
    db.add(column)
    db.commit()
    db.refresh(column)
    return _to_read(db, column)


def update_column(db: Session, user_id: uuid.UUID, column_id: uuid.UUID, payload: ColumnUpdate) -> ColumnRead:
    column = get_column_for_user(db, user_id, column_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(column, key, value)
    db.commit()
    db.refresh(column)
    return _to_read(db, column)


def reorder_column(db: Session, user_id: uuid.UUID, column_id: uuid.UUID, payload: ColumnReorder) -> ColumnRead:
    column = get_column_for_user(db, user_id, column_id)
    if column.archived_at is not None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Archived statuses cannot be reordered")

    active = list(
        db.scalars(
            select(BoardColumn)
            .where(BoardColumn.board_id == column.board_id, BoardColumn.archived_at.is_(None))
            .order_by(BoardColumn.position)
            .with_for_update()
        ).all()
    )
    old_index = next((i for i, item in enumerate(active) if item.id == column.id), None)
    if old_index is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Status not found")
    target = min(max(payload.target_position, 0), len(active) - 1)
    if target == old_index:
        return _to_read(db, column)

    active.pop(old_index)
    active.insert(target, column)
    for index, item in enumerate(active):
        item.position = -(index + 1)
    db.flush()
    for index, item in enumerate(active):
        item.position = index
    db.commit()
    db.refresh(column)
    return _to_read(db, column)


def archive_column(db: Session, user_id: uuid.UUID, column_id: uuid.UUID, payload: ColumnArchive) -> ColumnRead:
    column = get_column_for_user(db, user_id, column_id)
    if column.archived_at is not None:
        return _to_read(db, column)

    remaining = list(
        db.scalars(
            select(BoardColumn).where(
                BoardColumn.board_id == column.board_id,
                BoardColumn.id != column.id,
                BoardColumn.archived_at.is_(None),
            )
        ).all()
    )
    if not remaining:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The last active status cannot be archived",
        )

    count = _task_count(db, column.id)
    if count and payload.move_to_column_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This status still has tasks. Move them to another status before archiving.",
        )
    if payload.move_to_column_id is not None:
        target = get_column_for_user(db, user_id, payload.move_to_column_id)
        if target.board_id != column.board_id or target.archived_at is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Choose a valid active status to move tasks into",
            )
        if target.id == column.id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Tasks cannot be moved into the same status",
            )
        tasks = list(
            db.scalars(
                select(Task).where(Task.column_id == column.id).order_by(Task.position).with_for_update()
            ).all()
        )
        for index, parked in enumerate(tasks):
            parked.position = -(index + 1)
        db.flush()
        max_pos = db.scalar(
            select(func.coalesce(func.max(Task.position), -1)).where(Task.column_id == target.id)
        )
        assert max_pos is not None
        for index, task in enumerate(tasks):
            task.column_id = target.id
            task.position = max_pos + 1 + index
            if target.is_done and task.completed_at is None:
                task.completed_at = datetime.now(UTC)
            if not target.is_done:
                task.completed_at = None

    column.position = -1
    db.flush()
    column.archived_at = datetime.now(UTC)
    max_pos = db.scalar(
        select(func.coalesce(func.max(BoardColumn.position), -1)).where(
            BoardColumn.board_id == column.board_id,
            BoardColumn.id != column.id,
        )
    )
    column.position = _unused_column_position(
        db,
        column.board_id,
        start_from=max(1_000_000, int(max_pos or -1) + 1),
    )
    db.commit()
    db.refresh(column)
    return _to_read(db, column)


def restore_column(db: Session, user_id: uuid.UUID, column_id: uuid.UUID) -> ColumnRead:
    column = get_column_for_user(db, user_id, column_id)
    if column.archived_at is None:
        return _to_read(db, column)

    max_active = db.scalar(
        select(func.coalesce(func.max(BoardColumn.position), -1)).where(
            BoardColumn.board_id == column.board_id,
            BoardColumn.archived_at.is_(None),
        )
    )
    column.position = -1
    db.flush()
    column.archived_at = None
    column.position = _unused_column_position(
        db,
        column.board_id,
        start_from=int(max_active or -1) + 1,
    )
    db.commit()
    db.refresh(column)
    return _to_read(db, column)


def delete_column(db: Session, user_id: uuid.UUID, column_id: uuid.UUID) -> None:
    column = get_column_for_user(db, user_id, column_id)
    if column.archived_at is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Active statuses cannot be deleted. Archive the status first.",
        )
    if _task_count(db, column.id) > 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Statuses with tasks cannot be deleted",
        )
    db.delete(column)
    db.commit()
