from __future__ import annotations

from app.core.config import get_settings
from app.models import Task, TaskAttachment
from app.schemas.task import (
    TaskAttachmentRead,
    TaskDetailRead,
    TaskLinkRead,
    TaskSummaryRead,
)
from app.services.content_utils import content_preview, count_checklist_items


def to_summary(task: Task) -> TaskSummaryRead:
    completed, total = count_checklist_items(task.content)
    return TaskSummaryRead(
        id=task.id,
        column_id=task.column_id,
        title=task.title,
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
            f"{settings.public_base_url.rstrip('/')}"
            f"/api/v1/tasks/{attachment.task_id}/attachments/{attachment.id}/download"
        ),
    )


def to_detail(task: Task) -> TaskDetailRead:
    return TaskDetailRead(
        id=task.id,
        column_id=task.column_id,
        title=task.title,
        description=task.description,
        content=task.content,
        content_text=task.content_text,
        content_schema_version=task.content_schema_version,
        due_date=task.due_date,
        priority=task.priority,
        position=task.position,
        version=task.version,
        completed_at=task.completed_at,
        created_at=task.created_at,
        updated_at=task.updated_at,
        links=[TaskLinkRead.model_validate(link) for link in sorted(task.links, key=lambda l: l.position)],
        attachments=[to_attachment_read(a) for a in task.attachments],
    )
