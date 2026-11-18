from __future__ import annotations

import re
from typing import Any

from app.core.config import get_settings
from app.models import Task, TaskAttachment
from app.schemas.category import CategorySummary
from app.schemas.recurrence import RecurrenceRead
from app.schemas.task import (
    TaskAssigneeRead,
    TaskAttachmentRead,
    TaskDetailRead,
    TaskLinkRead,
    SubtaskRead,
    TaskParentRead,
    TaskSummaryRead,
)
from app.services.content_utils import content_preview, count_checklist_items


# An attachment link inside rich text, with whatever host it was saved under.
_ATTACHMENT_URL = re.compile(r"^(?:[a-zA-Z][a-zA-Z0-9+.-]*://[^/]+)?(/api/v1/tasks/[^/]+/attachments/[^/]+/download)$")


def with_current_attachment_urls(content: Any) -> Any:
    """Point inline images at PUBLIC_BASE_URL.

    Images are saved in the text with the full address the API had at the time, so moving the
    server (a new PUBLIC_BASE_URL) would break them. Rewriting on the way out keeps old tasks working
    without touching stored data.
    """
    base = get_settings().public_base

    def visit(node: Any) -> Any:
        if isinstance(node, list):
            return [visit(child) for child in node]
        if not isinstance(node, dict):
            return node
        result = {key: visit(value) for key, value in node.items()}
        attrs = result.get("attrs")
        if result.get("type") == "image" and isinstance(attrs, dict) and isinstance(attrs.get("src"), str):
            match = _ATTACHMENT_URL.match(attrs["src"])
            if match:
                result["attrs"] = {**attrs, "src": f"{base}{match.group(1)}"}
        return result

    return visit(content) if content is not None else None


def recurrence_from_task(task: Task) -> RecurrenceRead | None:
    series = getattr(task, "recurrence_series", None)
    if series is None or task.recurrence_series_id is None:
        return None
    return RecurrenceRead(
        series_id=series.id,
        status=series.status,  # type: ignore[arg-type]
        freq=series.freq,  # type: ignore[arg-type]
        interval=series.interval,
        weekdays=list(series.weekdays or []),
        month_day=series.month_day,
        until_date=series.until_date,
        occurrence_limit=series.occurrence_limit,
        occurrence_date=task.occurrence_date,
        original_occurrence_date=task.original_occurrence_date,
        is_detached=bool(task.is_detached),
        occurrence_index=task.occurrence_index,
    )


def assignees_from_task(task: Task) -> list[TaskAssigneeRead]:
    return [TaskAssigneeRead.model_validate(user) for user in task.assignees or []]


def to_subtask_read(task: Task) -> SubtaskRead:
    assert task.parent_task_id is not None
    return SubtaskRead(
        id=task.id,
        task_id=task.parent_task_id,
        title=task.title,
        is_completed=task.completed_at is not None,
        position=task.subtask_position or 0,
        column_id=task.column_id,
        start_date=task.start_date,
        due_date=task.due_date,
        priority=task.priority,
        completed_at=task.completed_at,
        assignees=assignees_from_task(task),
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


def _subtask_progress(task: Task) -> tuple[int, int]:
    subtasks = list(task.subtasks or [])
    total = len(subtasks)
    completed = sum(1 for item in subtasks if item.completed_at is not None)
    return completed, total


def to_summary(task: Task) -> TaskSummaryRead:
    completed, total = count_checklist_items(task.content)
    subtask_completed, subtask_total = _subtask_progress(task)
    return TaskSummaryRead(
        id=task.id,
        column_id=task.column_id,
        title=task.title,
        start_date=task.start_date,
        due_date=task.due_date,
        priority=task.priority,
        position=task.position,
        version=task.version,
        completed_at=task.completed_at,
        created_at=task.created_at,
        updated_at=task.updated_at,
        content_preview=content_preview(task.content_text, task.description),
        checklist_completed=completed,
        checklist_total=total,
        link_count=len(task.links) if task.links is not None else 0,
        attachment_count=len(task.attachments) if task.attachments is not None else 0,
        subtask_completed=subtask_completed,
        subtask_total=subtask_total,
        category=CategorySummary.model_validate(task.category),
        recurrence=recurrence_from_task(task),
        assignees=assignees_from_task(task),
    )


def to_attachment_read(attachment: TaskAttachment) -> TaskAttachmentRead:
    settings = get_settings()
    return TaskAttachmentRead(
        id=attachment.id,
        original_name=attachment.original_name,
        content_type=attachment.content_type,
        size_bytes=attachment.size_bytes,
        attachment_kind=attachment.attachment_kind,
        created_at=attachment.created_at,
        download_url=(
            f"{settings.public_base}/api/v1/tasks/{attachment.task_id}/attachments/{attachment.id}/download"
        ),
    )


def to_detail(task: Task) -> TaskDetailRead:
    return TaskDetailRead(
        id=task.id,
        column_id=task.column_id,
        title=task.title,
        description=task.description,
        content=with_current_attachment_urls(task.content),
        content_text=task.content_text,
        content_schema_version=task.content_schema_version,
        start_date=task.start_date,
        due_date=task.due_date,
        priority=task.priority,
        position=task.position,
        version=task.version,
        completed_at=task.completed_at,
        remind_at=task.remind_at,
        assignees=assignees_from_task(task),
        created_at=task.created_at,
        updated_at=task.updated_at,
        links=[TaskLinkRead.model_validate(link) for link in sorted(task.links, key=lambda l: l.position)],
        attachments=[to_attachment_read(a) for a in task.attachments],
        subtasks=[
            to_subtask_read(item)
            for item in sorted(task.subtasks or [], key=lambda subtask: subtask.subtask_position or 0)
        ],
        parent=TaskParentRead(id=task.parent.id, title=task.parent.title) if task.parent else None,
        category=CategorySummary.model_validate(task.category),
        recurrence=recurrence_from_task(task),
    )
