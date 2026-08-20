from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models import Task, TaskLink
from app.schemas.task import TaskCreate, TaskDetailRead, TaskLinkInput, TaskUpdate
from app.services.board_service import get_column_or_404
from app.services.category_service import ensure_category_on_board
from app.services.content_utils import extract_text_from_content, validate_content_urls
from app.services.ownership import get_task_for_user
from app.services.storage import get_storage
from app.services.task_serializers import to_detail


def _load_task(db: Session, user_id: uuid.UUID, task_id: uuid.UUID) -> Task:
    return get_task_for_user(db, user_id, task_id, with_details=True)


def _apply_content(task: Task, content: dict | None) -> None:
    validate_content_urls(content)
    task.content = content
    task.content_text = extract_text_from_content(content) if content else None
    task.content_schema_version = 1


def _replace_links(db: Session, task: Task, links: list[TaskLinkInput]) -> None:
    task.links.clear()
    db.flush()
    for item in sorted(links, key=lambda link: link.position):
        task.links.append(
            TaskLink(
                id=item.id or uuid.uuid4(),
                label=item.label.strip(),
                url=item.url,
                position=item.position,
            )
        )


def create_task(db: Session, user_id: uuid.UUID, payload: TaskCreate) -> TaskDetailRead:
    column = get_column_or_404(db, user_id, payload.column_id)
    ensure_category_on_board(db, payload.category_id, column.board_id)

    max_pos = db.scalar(
        select(func.coalesce(func.max(Task.position), -1)).where(
            Task.column_id == payload.column_id,
        )
    )
    assert max_pos is not None

    now = datetime.now(UTC)
    task = Task(
        column_id=payload.column_id,
        category_id=payload.category_id,
        title=payload.title.strip(),
        description=payload.description,
        start_date=payload.start_date or payload.due_date,
        due_date=payload.due_date,
        priority=payload.priority.value,
        position=max_pos + 1,
        version=1,
        completed_at=now if column.is_done else None,
    )
    _apply_content(task, payload.content)
    db.add(task)
    db.flush()
    if payload.links:
        _replace_links(db, task, payload.links)
    db.commit()
    return to_detail(_load_task(db, user_id, task.id))


def get_task(db: Session, user_id: uuid.UUID, task_id: uuid.UUID) -> TaskDetailRead:
    return to_detail(_load_task(db, user_id, task_id))


def update_task(db: Session, user_id: uuid.UUID, task_id: uuid.UUID, payload: TaskUpdate) -> TaskDetailRead:
    task = get_task_for_user(db, user_id, task_id, for_update=True)

    data = payload.model_dump(exclude_unset=True)
    links_payload = data.pop("links", None)
    new_due = data.pop("due_date", None)
    new_start = data.pop("start_date", None)
    content_provided = "content" in data
    content = data.pop("content", None) if content_provided else None
    new_category_id = data.pop("category_id", None) if "category_id" in data else None

    if "title" in data and data["title"] is not None:
        data["title"] = data["title"].strip()
    if "priority" in data and data["priority"] is not None:
        priority = data["priority"]
        data["priority"] = priority.value if hasattr(priority, "value") else priority

    if new_category_id is None and "category_id" in payload.model_fields_set:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="category_id cannot be null",
        )
    if new_category_id is not None:
        column = get_column_or_404(db, user_id, task.column_id)
        ensure_category_on_board(db, new_category_id, column.board_id)
        task.category_id = new_category_id

    # Due date no longer owns position; keep the column-wide slot.
    next_start = new_start if new_start is not None else task.start_date
    next_due = new_due if new_due is not None else task.due_date
    if next_start > next_due:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="start_date must be on or before due_date",
        )
    if new_start is not None:
        task.start_date = new_start
    if new_due is not None:
        task.due_date = new_due

    for key, value in data.items():
        setattr(task, key, value)

    if content_provided:
        _apply_content(task, content)

    if links_payload is not None:
        db.refresh(task, attribute_names=["links"])
        _replace_links(
            db,
            task,
            [TaskLinkInput.model_validate(item) for item in links_payload],
        )

    task.updated_at = datetime.now(UTC)
    db.commit()
    return to_detail(_load_task(db, user_id, task_id))


def delete_task(db: Session, user_id: uuid.UUID, task_id: uuid.UUID) -> None:
    task = _load_task(db, user_id, task_id)
    column_id = task.column_id
    old_position = task.position
    storage_keys = [attachment.storage_key for attachment in task.attachments]

    db.delete(task)
    db.flush()

    db.execute(
        update(Task)
        .where(
            Task.column_id == column_id,
            Task.position > old_position,
        )
        .values(position=Task.position - 1)
    )
    db.commit()

    storage = get_storage()
    for key in storage_keys:
        storage.delete(key)
