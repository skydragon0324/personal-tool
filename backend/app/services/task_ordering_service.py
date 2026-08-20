from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import Task
from app.schemas.task import TaskDetailRead, TaskMove
from app.services.ownership import get_column_for_user, get_task_for_user
from app.services.task_serializers import to_detail


def resolve_insert_index(
    sibling_ids: list[uuid.UUID],
    *,
    before_id: uuid.UUID | None,
    after_id: uuid.UUID | None,
    fallback_index: int | None,
) -> int:
    """Compute an insert index among siblings that exclude the moving item."""
    if after_id is not None:
        try:
            return sibling_ids.index(after_id) + 1
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Anchor item is not in the target list",
            ) from exc
    if before_id is not None:
        try:
            return sibling_ids.index(before_id)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Anchor item is not in the target list",
            ) from exc
    if fallback_index is not None:
        return min(max(fallback_index, 0), len(sibling_ids))
    return len(sibling_ids)


def move_task(db: Session, user_id: uuid.UUID, task_id: uuid.UUID, payload: TaskMove) -> TaskDetailRead:
    """Reorder a task inside one PostgreSQL transaction with row locks."""
    task = get_task_for_user(db, user_id, task_id, for_update=True)

    if task.version != payload.expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Task version is stale; refresh and try again",
        )

    target_column = get_column_for_user(db, user_id, payload.target_column_id)
    if target_column.archived_at is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot move a task into an archived status",
        )

    source_column_id = task.column_id
    source_column = get_column_for_user(db, user_id, source_column_id)
    if source_column.board_id != target_column.board_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot move a task to a status on another board",
        )
    old_position = task.position
    lock_column_ids = {source_column_id, payload.target_column_id}
    locked = list(
        db.scalars(
            select(Task)
            .where(Task.column_id.in_(lock_column_ids))
            .order_by(Task.column_id, Task.position)
            .with_for_update()
        ).all()
    )

    siblings = [
        item
        for item in locked
        if item.column_id == payload.target_column_id and item.id != task.id
    ]
    sibling_ids = [item.id for item in siblings]
    target_position = resolve_insert_index(
        sibling_ids,
        before_id=payload.before_task_id,
        after_id=payload.after_task_id,
        fallback_index=payload.target_position,
    )

    same_column = source_column_id == payload.target_column_id
    if same_column and target_position == old_position:
        return to_detail(_reload(db, user_id, task_id))

    task.position = -1
    db.flush()

    if same_column:
        if target_position > old_position:
            db.execute(
                update(Task)
                .where(
                    Task.column_id == source_column_id,
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
                    Task.position >= target_position,
                    Task.position < old_position,
                    Task.id != task_id,
                )
                .values(position=Task.position + 1)
            )
    else:
        db.execute(
            update(Task)
            .where(
                Task.column_id == source_column_id,
                Task.position > old_position,
            )
            .values(position=Task.position - 1)
        )
        db.execute(
            update(Task)
            .where(
                Task.column_id == payload.target_column_id,
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
    return to_detail(_reload(db, user_id, task_id))


def _reload(db: Session, user_id: uuid.UUID, task_id: uuid.UUID) -> Task:
    return get_task_for_user(db, user_id, task_id, with_details=True)
