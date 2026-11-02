"""Sub-tasks: full tasks that belong to a parent task.

A sub-task is a regular ``Task`` row with ``parent_task_id`` set, so it has everything a task has
(content, dates, priority, category, assignees, links, files, reminder, status) and is edited
through the normal task endpoints. It sits in a status column like any task but is left out of
task lists; it is reached through its parent. These endpoints manage the parent's list: add by
title, rename, tick done/undone (which moves it between open and done statuses), reorder, delete.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import BoardColumn, Task
from app.schemas.task import SubtaskCreate, SubtaskRead, SubtaskReorder, SubtaskUpdate, TaskMove
from app.services.ownership import get_task_for_user
from app.services.task_ordering_service import move_task, resolve_insert_index
from app.services.task_serializers import to_subtask_read


def _child_or_404(db: Session, parent: Task, subtask_id: uuid.UUID) -> Task:
    child = db.get(Task, subtask_id)
    if child is None or child.parent_task_id != parent.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subtask not found")
    return child


def _children(db: Session, parent_id: uuid.UUID) -> list[Task]:
    return list(
        db.scalars(
            select(Task)
            .where(Task.parent_task_id == parent_id)
            .order_by(Task.subtask_position, Task.created_at)
        ).all()
    )


def _active_columns(db: Session, board_id: uuid.UUID) -> list[BoardColumn]:
    return list(
        db.scalars(
            select(BoardColumn)
            .where(BoardColumn.board_id == board_id, BoardColumn.archived_at.is_(None))
            .order_by(BoardColumn.position)
        ).all()
    )


def _open_column(preferred: BoardColumn, columns: list[BoardColumn]) -> BoardColumn:
    """``preferred`` when it is an open status, otherwise the board's first open status."""
    if not preferred.is_done and preferred.archived_at is None:
        return preferred
    return next((column for column in columns if not column.is_done), preferred)


def _next_column_position(db: Session, column_id: uuid.UUID) -> int:
    max_pos = db.scalar(
        select(func.coalesce(func.max(Task.position), -1)).where(Task.column_id == column_id)
    )
    return int(max_pos if max_pos is not None else -1) + 1


def list_subtasks(db: Session, user_id: uuid.UUID, task_id: uuid.UUID) -> list[SubtaskRead]:
    get_task_for_user(db, user_id, task_id)
    return [to_subtask_read(item) for item in _children(db, task_id)]


def create_subtask(db: Session, user_id: uuid.UUID, task_id: uuid.UUID, payload: SubtaskCreate) -> SubtaskRead:
    """Add a sub-task by title; it starts with the parent's category and dates."""
    parent = get_task_for_user(db, user_id, task_id, for_update=True)
    if parent.parent_task_id is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A sub-task cannot have its own sub-tasks",
        )
    parent_column = db.get(BoardColumn, parent.column_id)
    assert parent_column is not None
    column = _open_column(parent_column, _active_columns(db, parent_column.board_id))
    max_subtask = db.scalar(
        select(func.coalesce(func.max(Task.subtask_position), -1)).where(Task.parent_task_id == parent.id)
    )
    child = Task(
        column_id=column.id,
        category_id=parent.category_id,
        title=payload.title,
        start_date=parent.start_date,
        due_date=parent.due_date,
        priority="medium",
        position=_next_column_position(db, column.id),
        version=1,
        completed_at=datetime.now(UTC) if column.is_done else None,
        content_schema_version=1,
        parent_task_id=parent.id,
        subtask_position=int(max_subtask if max_subtask is not None else -1) + 1,
    )
    db.add(child)
    db.commit()
    db.refresh(child)
    return to_subtask_read(child)


def _set_completed(db: Session, user_id: uuid.UUID, child: Task, completed: bool) -> None:
    """Tick a sub-task done (move it to the first done status) or open again."""
    if (child.completed_at is not None) == completed:
        return
    current = db.get(BoardColumn, child.column_id)
    assert current is not None
    columns = _active_columns(db, current.board_id)
    if completed:
        target = next((column for column in columns if column.is_done), None)
    else:
        parent_column = db.get(BoardColumn, child.parent.column_id) if child.parent else None
        target = _open_column(parent_column or current, columns)
    if target is None or target.id == child.column_id or target.is_done != completed:
        # No status fits (e.g. the board has no done status): just record the state.
        child.completed_at = datetime.now(UTC) if completed else None
        child.version += 1
        child.updated_at = datetime.now(UTC)
        db.commit()
        return
    move_task(db, user_id, child.id, TaskMove(target_column_id=target.id, expected_version=child.version))


def update_subtask(
    db: Session,
    user_id: uuid.UUID,
    task_id: uuid.UUID,
    subtask_id: uuid.UUID,
    payload: SubtaskUpdate,
) -> SubtaskRead:
    parent = get_task_for_user(db, user_id, task_id)
    child = _child_or_404(db, parent, subtask_id)
    if payload.title is not None and payload.title != child.title:
        child.title = payload.title
        child.updated_at = datetime.now(UTC)
        db.commit()
    if payload.is_completed is not None:
        _set_completed(db, user_id, child, payload.is_completed)
    db.refresh(child)
    return to_subtask_read(child)


def delete_subtask(db: Session, user_id: uuid.UUID, task_id: uuid.UUID, subtask_id: uuid.UUID) -> None:
    from app.services.task_service import delete_task

    parent = get_task_for_user(db, user_id, task_id)
    child = _child_or_404(db, parent, subtask_id)
    delete_task(db, user_id, child.id)


def reorder_subtasks(db: Session, user_id: uuid.UUID, task_id: uuid.UUID, payload: SubtaskReorder) -> list[SubtaskRead]:
    get_task_for_user(db, user_id, task_id, for_update=True)
    items = _children(db, task_id)
    moving = next((item for item in items if item.id == payload.subtask_id), None)
    if moving is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subtask not found")

    siblings = [item for item in items if item.id != moving.id]
    target = resolve_insert_index(
        [item.id for item in siblings],
        before_id=payload.before_subtask_id,
        after_id=payload.after_subtask_id,
        fallback_index=None,
    )
    siblings.insert(target, moving)
    for index, item in enumerate(siblings):
        if item.subtask_position != index:
            item.subtask_position = index
    moving.updated_at = datetime.now(UTC)
    db.commit()
    return list_subtasks(db, user_id, task_id)
