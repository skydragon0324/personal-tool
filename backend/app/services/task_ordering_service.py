from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app.models import BoardColumn, Task
from app.schemas.task import TaskDetailRead, TaskMove
from app.services.task_serializers import to_detail


def move_task(db: Session, task_id: uuid.UUID, payload: TaskMove) -> TaskDetailRead:
    """Reorder a task inside one PostgreSQL transaction with row locks."""
    task = db.scalar(select(Task).where(Task.id == task_id).with_for_update())
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if task.version != payload.expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Task version is stale; refresh and try again",
        )

    target_column = db.get(BoardColumn, payload.target_column_id)
    if target_column is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target column not found")

    source_column_id = task.column_id
    due_date = task.due_date
    old_position = task.position
    target_position = payload.target_position

    # Lock all tasks in source and target columns for this due date.
    lock_column_ids = {source_column_id, payload.target_column_id}
    db.scalars(
        select(Task)
        .where(Task.column_id.in_(lock_column_ids), Task.due_date == due_date)
        .order_by(Task.column_id, Task.position)
        .with_for_update()
    ).all()

    same_column = source_column_id == payload.target_column_id

    if same_column:
        if target_position == old_position:
            return TaskRead.model_validate(task)

        # Temporarily park the moving task to avoid unique collisions.
        task.position = -1
        db.flush()

        if target_position > old_position:
            db.execute(
                update(Task)
                .where(
                    Task.column_id == source_column_id,
                    Task.due_date == due_date,
                    Task.position > old_position,
                    Task.position <= target_position,
                    Task.id != task_id,
                )
                .values(position=Task.position - 1)
            )
        else:
            db.execute(
                update(Task)
                .where(
                    Task.column_id == source_column_id,
                    Task.due_date == due_date,
                    Task.position >= target_position,
                    Task.position < old_position,
                    Task.id != task_id,
                )
                .values(position=Task.position + 1)
            )
    else:
        # Close gap in source column.
        db.execute(
            update(Task)
            .where(
                Task.column_id == source_column_id,
                Task.due_date == due_date,
                Task.position > old_position,
            )
            .values(position=Task.position - 1)
        )
        # Open gap in target column.
        db.execute(
            update(Task)
            .where(
                Task.column_id == payload.target_column_id,
                Task.due_date == due_date,
                Task.position >= target_position,
            )
            .values(position=Task.position + 1)
        )

    task.column_id = payload.target_column_id
    task.position = target_position
    task.version += 1
    task.updated_at = datetime.now(UTC)
    task.completed_at = datetime.now(UTC) if target_column.is_done else None

    db.commit()
    refreshed = db.scalar(
        select(Task)
        .where(Task.id == task_id)
        .options(selectinload(Task.links), selectinload(Task.attachments))
    )
    assert refreshed is not None
    return to_detail(refreshed)
