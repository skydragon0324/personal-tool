from uuid import UUID

from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.task import (
    TaskAttachmentRead,
    TaskCreate,
    TaskDetailRead,
    TaskMove,
    TaskUpdate,
)
from app.services import attachment_service, task_ordering_service, task_service

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("", response_model=TaskDetailRead, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)) -> TaskDetailRead:
    return task_service.create_task(db, payload)


@router.get("/{task_id}", response_model=TaskDetailRead)
def get_task(task_id: UUID, db: Session = Depends(get_db)) -> TaskDetailRead:
    return task_service.get_task(db, task_id)


@router.patch("/{task_id}", response_model=TaskDetailRead)
def update_task(task_id: UUID, payload: TaskUpdate, db: Session = Depends(get_db)) -> TaskDetailRead:
    return task_service.update_task(db, task_id, payload)


@router.patch("/{task_id}/move", response_model=TaskDetailRead)
def move_task(task_id: UUID, payload: TaskMove, db: Session = Depends(get_db)) -> TaskDetailRead:
    return task_ordering_service.move_task(db, task_id, payload)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: UUID, db: Session = Depends(get_db)) -> Response:
    task_service.delete_task(db, task_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{task_id}/attachments",
    response_model=TaskAttachmentRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_attachment(
    task_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> TaskAttachmentRead:
    return await attachment_service.upload_attachment(db, task_id, file)


@router.get("/{task_id}/attachments/{attachment_id}/download")
def download_attachment(
    task_id: UUID,
    attachment_id: UUID,
    db: Session = Depends(get_db),
) -> FileResponse:
    return attachment_service.download_attachment(db, task_id, attachment_id)


@router.delete(
    "/{task_id}/attachments/{attachment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_attachment(
    task_id: UUID,
    attachment_id: UUID,
    db: Session = Depends(get_db),
) -> Response:
    attachment_service.delete_attachment(db, task_id, attachment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
