"""Copying a task and moving a task to another board."""

from __future__ import annotations

import copy
import json
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models import (
    Board,
    BoardColumn,
    Category,
    Notification,
    Task,
    TaskAttachment,
    TaskLink,
    TaskSubtask,
)
from app.schemas.task import TaskDetailRead, TaskMoveToBoard
from app.services.ownership import get_board_for_user, get_task_for_user
from app.services.storage import get_storage
from app.services.task_serializers import to_detail

COPY_SUFFIX = " (copy)"


def _attachment_path(task_id: uuid.UUID, attachment_id: uuid.UUID) -> str:
    return f"/api/v1/tasks/{task_id}/attachments/{attachment_id}/download"


def _copy_content(content: dict | None, url_map: dict[str, str]) -> dict | None:
    """Deep-copy rich text, pointing inline images at the copied attachments."""
    if content is None:
        return None
    if not url_map:
        return copy.deepcopy(content)
    raw = json.dumps(content)
    for old, new in url_map.items():
        raw = raw.replace(old, new)
    return json.loads(raw)


def duplicate_task(db: Session, user_id: uuid.UUID, task_id: uuid.UUID) -> TaskDetailRead:
    """Copy a task with its content, links, sub-tasks and files, right below the original.

    The copy is a standalone task: it is not assigned to anyone, has no reminder and does not
    repeat, even when the original does.
    """
    original = get_task_for_user(db, user_id, task_id, with_details=True)
    column = db.get(BoardColumn, original.column_id)
    assert column is not None

    # Open a slot directly below the original (positions are unique per column, deferred).
    db.execute(
        update(Task)
        .where(Task.column_id == original.column_id, Task.position > original.position)
        .values(position=Task.position + 1)
    )
    now = datetime.now(UTC)
    title = original.title
    if len(title) + len(COPY_SUFFIX) <= 160:
        title += COPY_SUFFIX
    duplicate = Task(
        id=uuid.uuid4(),
        column_id=original.column_id,
        category_id=original.category_id,
        title=title,
        description=original.description,
        start_date=original.start_date,
        due_date=original.due_date,
        priority=original.priority,
        position=original.position + 1,
        version=1,
        completed_at=now if column.is_done else None,
        content_schema_version=original.content_schema_version,
    )
    db.add(duplicate)
    db.flush()

    storage = get_storage()
    new_keys: list[str] = []
    url_map: dict[str, str] = {}
    try:
        # Read children straight from the database rather than possibly stale relationships.
        def children(model):
            return db.scalars(select(model).where(model.task_id == original.id).order_by(model.created_at)).all()

        for attachment in children(TaskAttachment):
            data = storage.open(attachment.storage_key).read_bytes()
            key, kind, size = storage.save(
                original_name=attachment.original_name,
                content_type=attachment.content_type,
                data=data,
            )
            new_keys.append(key)
            copied = TaskAttachment(
                id=uuid.uuid4(),
                task_id=duplicate.id,
                original_name=attachment.original_name,
                storage_key=key,
                content_type=attachment.content_type,
                size_bytes=size,
                attachment_kind=kind,
            )
            db.add(copied)
            url_map[_attachment_path(original.id, attachment.id)] = _attachment_path(duplicate.id, copied.id)

        duplicate.content = _copy_content(original.content, url_map)
        duplicate.content_text = original.content_text
        for link in children(TaskLink):
            db.add(
                TaskLink(task_id=duplicate.id, label=link.label, url=link.url, position=link.position)
            )
        for subtask in children(TaskSubtask):
            db.add(
                TaskSubtask(
                    task_id=duplicate.id,
                    title=subtask.title,
                    is_completed=subtask.is_completed,
                    position=subtask.position,
                )
            )
        db.commit()
        db.expire(duplicate)
    except Exception:
        db.rollback()
        for key in new_keys:
            storage.delete(key)
        raise
    return to_detail(get_task_for_user(db, user_id, duplicate.id, with_details=True))


def _target_column(db: Session, board: Board, column_id: uuid.UUID | None) -> BoardColumn:
    if column_id is not None:
        column = db.scalar(
            select(BoardColumn).where(
                BoardColumn.id == column_id,
                BoardColumn.board_id == board.id,
                BoardColumn.archived_at.is_(None),
            )
        )
        if column is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Choose an active status on the target board",
            )
        return column
    columns = list(
        db.scalars(
            select(BoardColumn)
            .where(BoardColumn.board_id == board.id, BoardColumn.archived_at.is_(None))
            .order_by(BoardColumn.position)
        ).all()
    )
    if not columns:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The target board has no statuses yet",
        )
    return next((column for column in columns if not column.is_done), columns[0])


def _matching_category(db: Session, source: Category, board_id: uuid.UUID) -> Category:
    """The target board's category with the same name, created if it does not exist yet."""
    existing = db.scalar(
        select(Category).where(
            Category.board_id == board_id, func.lower(Category.name) == source.name.lower()
        )
    )
    if existing is not None:
        return existing
    max_pos = db.scalar(
        select(func.coalesce(func.max(Category.position), -1)).where(Category.board_id == board_id)
    )
    category = Category(
        board_id=board_id, name=source.name, color=source.color, position=int(max_pos or -1) + 1
    )
    db.add(category)
    db.flush()
    return category


def move_to_board(
    db: Session, user_id: uuid.UUID, task_id: uuid.UUID, payload: TaskMoveToBoard
) -> TaskDetailRead:
    """Move a task, with everything attached to it, to another board the user can access.

    Assignees stay only if they are also on the target board. A repeating task's occurrence
    leaves its series and becomes a one-off task on the new board.
    """
    from app.services.board_member_service import participant_ids
    from app.services.notification_service import dismiss_task_notifications
    from app.services.recurrence_service import _add_exception

    task = get_task_for_user(db, user_id, task_id, with_details=True, for_update=True)
    if payload.expected_version is not None and task.version != payload.expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Task version is stale; refresh and try again",
        )
    source_column = db.get(BoardColumn, task.column_id)
    assert source_column is not None
    target_board = get_board_for_user(db, user_id, payload.board_id)
    if target_board.archived_at is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tasks cannot be moved to an archived board",
        )
    if target_board.id == source_column.board_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The task is already on this board",
        )
    target_column = _target_column(db, target_board, payload.column_id)

    task.category = _matching_category(db, task.category, target_board.id)
    # Keep only the assignees who are also on the target board.
    allowed = participant_ids(db, target_board)
    task.assignees = [user for user in task.assignees if user.id in allowed]

    if task.recurrence_series_id is not None:
        if task.original_occurrence_date is not None:
            # Keep the series from generating this date again on the old board.
            _add_exception(db, task.recurrence_series_id, task.original_occurrence_date)
        task.recurrence_series_id = None
        task.recurrence_series = None
        task.occurrence_date = None
        task.original_occurrence_date = None
        task.occurrence_index = None
        task.is_detached = False

    old_position = task.position
    max_pos = db.scalar(
        select(func.coalesce(func.max(Task.position), -1)).where(Task.column_id == target_column.id)
    )
    task.column_id = target_column.id
    task.position = int(max_pos if max_pos is not None else -1) + 1
    db.flush()
    # Close the gap in the old column.
    db.execute(
        update(Task)
        .where(Task.column_id == source_column.id, Task.position > old_position)
        .values(position=Task.position - 1)
    )

    now = datetime.now(UTC)
    if target_column.is_done and task.completed_at is None:
        task.completed_at = now
        dismiss_task_notifications(db, task.id)
    elif not target_column.is_done:
        task.completed_at = None
    task.version += 1
    task.updated_at = now
    db.execute(
        update(Notification).where(Notification.task_id == task.id).values(board_id=target_board.id)
    )
    db.commit()
    return to_detail(get_task_for_user(db, user_id, task.id, with_details=True))
