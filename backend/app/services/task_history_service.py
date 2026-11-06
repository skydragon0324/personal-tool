"""Change history for tasks.

Every API call that changes a task runs inside ``track_changes``: it takes a snapshot of the task
before and after and stores the difference as one history entry. Doing it around the call (not
inside each service) covers every way a task changes: the edit form, drag and drop, repeating-task
scopes, moving to another board, files and sub-tasks.

Values are stored as display text (status, category, board and people's names), so an entry still
reads correctly after something is renamed or deleted.
"""

from __future__ import annotations

import logging
import uuid
from collections import Counter
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Board,
    BoardColumn,
    Category,
    Task,
    TaskAssignee,
    TaskAttachment,
    TaskHistoryEntry,
    TaskLink,
    User,
)
from app.schemas.task_history import TaskHistoryRead
from app.services.ownership import get_task_for_user

logger = logging.getLogger(__name__)

# Fields compared as single values, in the order they are listed in an entry.
SCALAR_FIELDS = ("title", "board", "status", "category", "priority", "start_date", "due_date", "reminder", "repeat")
# Fields compared as lists: an entry lists what was added and what was removed.
LIST_FIELDS = ("assignees", "subtasks", "links", "files")
# Compared but not stored (too long to show): the entry just says it changed.
TEXT_FIELDS = ("details",)

Snapshot = dict[str, Any]


def snapshot(db: Session, task_id: uuid.UUID) -> Snapshot | None:
    """The task's tracked fields as display values, read fresh from the database."""
    task = db.get(Task, task_id, populate_existing=True)
    if task is None:
        return None
    column = db.get(BoardColumn, task.column_id)
    board = db.get(Board, column.board_id) if column else None
    category = db.get(Category, task.category_id)
    assignees = db.scalars(
        select(User.display_name)
        .join(TaskAssignee, TaskAssignee.user_id == User.id)
        .where(TaskAssignee.task_id == task.id)
        .order_by(User.display_name)
    ).all()
    links = db.scalars(select(TaskLink).where(TaskLink.task_id == task.id).order_by(TaskLink.position)).all()
    files = db.scalars(
        select(TaskAttachment.original_name)
        .where(TaskAttachment.task_id == task.id)
        .order_by(TaskAttachment.created_at)
    ).all()
    subtasks = db.scalars(
        select(Task.title).where(Task.parent_task_id == task.id).order_by(Task.subtask_position)
    ).all()
    return {
        "title": task.title,
        "board": board.name if board else None,
        "status": column.name if column else None,
        "category": category.name if category else None,
        "priority": task.priority,
        "start_date": task.start_date.isoformat(),
        "due_date": task.due_date.isoformat(),
        "reminder": task.remind_at.isoformat() if task.remind_at else None,
        "repeat": task.recurrence_series_id is not None,
        "assignees": list(assignees),
        "subtasks": list(subtasks),
        "links": [link.label or link.url for link in links],
        "files": list(files),
        "details": task.content_text or "",
    }


def diff(before: Snapshot, after: Snapshot) -> list[dict[str, Any]]:
    changes: list[dict[str, Any]] = []
    for field in SCALAR_FIELDS:
        if before[field] != after[field]:
            changes.append({"field": field, "from": before[field], "to": after[field]})
    for field in TEXT_FIELDS:
        if before[field] != after[field]:
            changes.append({"field": field})
    for field in LIST_FIELDS:
        old, new = Counter(before[field]), Counter(after[field])
        added = list((new - old).elements())
        removed = list((old - new).elements())
        if added or removed:
            changes.append({"field": field, "added": added, "removed": removed})
    return changes


def _add_entry(
    db: Session,
    task_id: uuid.UUID,
    actor: tuple[uuid.UUID, str],
    action: str,
    changes: list[dict[str, Any]],
) -> None:
    db.add(
        TaskHistoryEntry(
            task_id=task_id,
            actor_id=actor[0],
            actor_name=actor[1],
            action=action,
            changes=changes,
        )
    )


def _give_up(db: Session, what: str, task_ids: list[uuid.UUID]) -> None:
    """History is a side record: if writing it fails, the change itself must still succeed."""
    logger.exception("Could not %s task history for %s", what, task_ids)
    db.rollback()


def record_created(db: Session, task_id: uuid.UUID, actor: User) -> None:
    """Note that `actor` created the task. Commits; never raises."""
    try:
        _add_entry(db, task_id, (actor.id, actor.display_name), "created", [])
        db.commit()
    except Exception:
        _give_up(db, "record", [task_id])


@contextmanager
def track_changes(db: Session, actor: User, *task_ids: uuid.UUID | None) -> Iterator[None]:
    """Record what the wrapped code changed on each task.

    Nothing is recorded if the wrapped code raises. A failure while recording is logged and
    skipped, so it never turns a successful change into an error.
    """
    ids = [task_id for task_id in dict.fromkeys(task_ids) if task_id is not None]
    who = (actor.id, actor.display_name)
    try:
        before = {task_id: snapshot(db, task_id) for task_id in ids}
    except Exception:
        _give_up(db, "read", ids)
        before = {}
    yield
    if not before:
        return
    try:
        recorded = False
        for task_id in ids:
            old = before.get(task_id)
            new = snapshot(db, task_id)
            if old is None or new is None:
                continue  # Missing before (not visible) or deleted by the call.
            changes = diff(old, new)
            if changes:
                _add_entry(db, task_id, who, "updated", changes)
                recorded = True
        if recorded:
            db.commit()
    except Exception:
        _give_up(db, "record", ids)


def list_history(db: Session, user_id: uuid.UUID, task_id: uuid.UUID) -> list[TaskHistoryRead]:
    """Newest first. The actor's current name is shown when the account still exists."""
    get_task_for_user(db, user_id, task_id)
    rows = db.execute(
        select(TaskHistoryEntry, User.display_name)
        .outerjoin(User, User.id == TaskHistoryEntry.actor_id)
        .where(TaskHistoryEntry.task_id == task_id)
        .order_by(TaskHistoryEntry.created_at.desc(), TaskHistoryEntry.id)
    ).all()
    return [
        TaskHistoryRead(
            id=entry.id,
            created_at=entry.created_at,
            actor_id=entry.actor_id,
            actor_name=current_name or entry.actor_name,
            action=entry.action,
            changes=entry.changes,
        )
        for entry, current_name in rows
    ]
