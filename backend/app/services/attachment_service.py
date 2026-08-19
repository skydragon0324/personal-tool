from __future__ import annotations

import uuid

from fastapi import HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.models import Task, TaskAttachment
from app.schemas.task import TaskAttachmentRead
from app.services.storage import get_storage, read_upload_limited
from app.services.task_serializers import to_attachment_read


def _get_task_or_404(db: Session, task_id: uuid.UUID) -> Task:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


async def upload_attachment(
    db: Session,
    task_id: uuid.UUID,
    upload: UploadFile,
) -> TaskAttachmentRead:
    _get_task_or_404(db, task_id)
    settings = get_settings()
    data = await read_upload_limited(upload, settings.max_upload_bytes)
    storage = get_storage()
    storage_key, kind, size = storage.save(
        original_name=upload.filename or "file",
        content_type=upload.content_type or "application/octet-stream",
        data=data,
    )
    attachment = TaskAttachment(
        task_id=task_id,
        original_name=upload.filename or "file",
        storage_key=storage_key,
        content_type=(upload.content_type or "application/octet-stream").split(";")[0].strip(),
        size_bytes=size,
        attachment_kind=kind,
    )
    # Re-validate original name through storage helpers already applied
    from app.services.storage import safe_original_name

    attachment.original_name = safe_original_name(upload.filename or "file")
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return to_attachment_read(attachment)


def download_attachment(db: Session, task_id: uuid.UUID, attachment_id: uuid.UUID) -> FileResponse:
    attachment = db.scalar(
        select(TaskAttachment).where(
            TaskAttachment.id == attachment_id,
            TaskAttachment.task_id == task_id,
        )
    )
    if attachment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    path = get_storage().open(attachment.storage_key)
    return FileResponse(
        path=path,
        media_type=attachment.content_type,
        filename=attachment.original_name,
    )


def delete_attachment(db: Session, task_id: uuid.UUID, attachment_id: uuid.UUID) -> None:
    attachment = db.scalar(
        select(TaskAttachment).where(
            TaskAttachment.id == attachment_id,
            TaskAttachment.task_id == task_id,
        )
    )
    if attachment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    storage_key = attachment.storage_key
    db.delete(attachment)
    db.commit()
    get_storage().delete(storage_key)
