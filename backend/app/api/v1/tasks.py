from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.schemas.task import (
    TaskAttachmentRead,
    TaskCreate,
    TaskDetailRead,
    TaskMove,
    TaskUpdate,
    SubtaskCreate,
    SubtaskRead,
    SubtaskReorder,
    SubtaskUpdate,
)
from app.services import attachment_service, subtask_service, task_ordering_service, task_service

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("", response_model=TaskDetailRead, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, user: CurrentUser, db: Session = Depends(get_db)) -> TaskDetailRead:
    return task_service.create_task(db, user.id, payload)


@router.get("/{task_id}", response_model=TaskDetailRead)
def get_task(task_id: UUID, user: CurrentUser, db: Session = Depends(get_db)) -> TaskDetailRead:
    return task_service.get_task(db, user.id, task_id)


@router.patch("/{task_id}", response_model=TaskDetailRead)
def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    user: CurrentUser,
    db: Session = Depends(get_db),
) -> TaskDetailRead:
    return task_service.update_task(db, user.id, task_id, payload)


@router.patch("/{task_id}/move", response_model=TaskDetailRead)
def move_task(
    task_id: UUID,
    payload: TaskMove,
    user: CurrentUser,
    db: Session = Depends(get_db),
) -> TaskDetailRead:
    return task_ordering_service.move_task(db, user.id, task_id, payload)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: UUID,
    user: CurrentUser,
    db: Session = Depends(get_db),
    delete_scope: str = Query(default="this"),
    confirm_completed: bool = Query(default=False),
) -> Response:
    task_service.delete_task(
        db,
        user.id,
        task_id,
        delete_scope=delete_scope,
        confirm_completed=confirm_completed,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{task_id}/attachments",
    response_model=TaskAttachmentRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_attachment(
    task_id: UUID,
    user: CurrentUser,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> TaskAttachmentRead:
    return await attachment_service.upload_attachment(db, user.id, task_id, file)


@router.get("/{task_id}/attachments/{attachment_id}/download")
def download_attachment(
    task_id: UUID,
    attachment_id: UUID,
    user: CurrentUser,
    db: Session = Depends(get_db),
) -> FileResponse:
    return attachment_service.download_attachment(db, user.id, task_id, attachment_id)


@router.delete(
    "/{task_id}/attachments/{attachment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_attachment(
    task_id: UUID,
    attachment_id: UUID,
    user: CurrentUser,
    db: Session = Depends(get_db),
) -> Response:
    attachment_service.delete_attachment(db, user.id, task_id, attachment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{task_id}/subtasks",
    response_model=SubtaskRead,
    status_code=status.HTTP_201_CREATED,
)
def create_subtask(
    task_id: UUID,
    payload: SubtaskCreate,
    user: CurrentUser,
    db: Session = Depends(get_db),
) -> SubtaskRead:
    return subtask_service.create_subtask(db, user.id, task_id, payload)


@router.patch("/{task_id}/subtasks/reorder", response_model=list[SubtaskRead])
def reorder_subtasks(
    task_id: UUID,
    payload: SubtaskReorder,
    user: CurrentUser,
    db: Session = Depends(get_db),
) -> list[SubtaskRead]:
    return subtask_service.reorder_subtasks(db, user.id, task_id, payload)


@router.patch("/{task_id}/subtasks/{subtask_id}", response_model=SubtaskRead)
def update_subtask(
    task_id: UUID,
    subtask_id: UUID,
    payload: SubtaskUpdate,
    user: CurrentUser,
    db: Session = Depends(get_db),
) -> SubtaskRead:
    return subtask_service.update_subtask(db, user.id, task_id, subtask_id, payload)


@router.delete(
    "/{task_id}/subtasks/{subtask_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_subtask(
    task_id: UUID,
    subtask_id: UUID,
    user: CurrentUser,
    db: Session = Depends(get_db),
) -> Response:
    subtask_service.delete_subtask(db, user.id, task_id, subtask_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
