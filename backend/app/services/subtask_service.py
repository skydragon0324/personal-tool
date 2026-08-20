from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models import Task, TaskSubtask
from app.schemas.task import SubtaskCreate, SubtaskRead, SubtaskReorder, SubtaskUpdate
from app.services.task_ordering_service import resolve_insert_index


def _get_task_or_404(db: Session, task_id: uuid.UUID) -> Task:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


def _get_subtask_or_404(db: Session, task_id: uuid.UUID, subtask_id: uuid.UUID) -> TaskSubtask:
    subtask = db.get(TaskSubtask, subtask_id)
    if subtask is None or subtask.task_id != task_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subtask not found")
    return subtask


def list_subtasks(db: Session, task_id: uuid.UUID) -> list[SubtaskRead]:
    _get_task_or_404(db, task_id)
    items = list(
        db.scalars(
            select(TaskSubtask).where(TaskSubtask.task_id == task_id).order_by(TaskSubtask.position)
        ).all()
    )
    return [SubtaskRead.model_validate(item) for item in items]


def create_subtask(db: Session, task_id: uuid.UUID, payload: SubtaskCreate) -> SubtaskRead:
    _get_task_or_404(db, task_id)
    max_pos = db.scalar(
        select(func.coalesce(func.max(TaskSubtask.position), -1)).where(TaskSubtask.task_id == task_id)
    )
    assert max_pos is not None
    subtask = TaskSubtask(
        task_id=task_id,
        title=payload.title,
        is_completed=False,
        position=max_pos + 1,
    )
    db.add(subtask)
    db.commit()
    db.refresh(subtask)
    return SubtaskRead.model_validate(subtask)


def update_subtask(
    db: Session,
    task_id: uuid.UUID,
    subtask_id: uuid.UUID,
    payload: SubtaskUpdate,
) -> SubtaskRead:
    subtask = _get_subtask_or_404(db, task_id, subtask_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(subtask, key, value)
    subtask.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(subtask)
    return SubtaskRead.model_validate(subtask)


def delete_subtask(db: Session, task_id: uuid.UUID, subtask_id: uuid.UUID) -> None:
    subtask = _get_subtask_or_404(db, task_id, subtask_id)
    position = subtask.position
    db.delete(subtask)
    db.flush()
    db.execute(
        update(TaskSubtask)
        .where(TaskSubtask.task_id == task_id, TaskSubtask.position > position)
        .values(position=TaskSubtask.position - 1)
    )
    db.commit()


def reorder_subtasks(db: Session, task_id: uuid.UUID, payload: SubtaskReorder) -> list[SubtaskRead]:
    _get_task_or_404(db, task_id)
    items = list(
        db.scalars(
            select(TaskSubtask)
            .where(TaskSubtask.task_id == task_id)
            .order_by(TaskSubtask.position)
            .with_for_update()
        ).all()
    )
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
    old = moving.position
    if target == old:
        return [SubtaskRead.model_validate(item) for item in items]

    moving.position = -1
    db.flush()
    if target > old:
        db.execute(
            update(TaskSubtask)
            .where(
                TaskSubtask.task_id == task_id,
                TaskSubtask.position > old,
                TaskSubtask.position <= target,
                TaskSubtask.id != moving.id,
            )
            .values(position=TaskSubtask.position - 1)
        )
    else:
        db.execute(
            update(TaskSubtask)
            .where(
                TaskSubtask.task_id == task_id,
                TaskSubtask.position >= target,
                TaskSubtask.position < old,
                TaskSubtask.id != moving.id,
            )
            .values(position=TaskSubtask.position + 1)
        )
    moving.position = target
    moving.updated_at = datetime.now(UTC)
    db.commit()
    return list_subtasks(db, task_id)
