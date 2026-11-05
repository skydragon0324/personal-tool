from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.models import Task
from app.schemas.task import (
    TaskAttachmentRead,
    TaskCreate,
    TaskDetailRead,
    TaskMove,
    TaskMoveToBoard,
    TaskUpdate,
    SubtaskCreate,
    SubtaskRead,
    SubtaskReorder,
    SubtaskUpdate,
)
from app.schemas.task_history import TaskHistoryRead
from app.services import (
    attachment_service,
    subtask_service,
    task_ordering_service,
    task_service,
    task_history_service,
    task_transfer_service,
)
from app.services.task_history_service import record_created, track_changes

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _with_parent(db: Session, task_id: UUID) -> tuple[UUID, UUID | None]:
    """The task and its parent: a sub-task's change can also change the parent's sub-task list."""
    return task_id, db.scalar(select(Task.parent_task_id).where(Task.id == task_id))


@router.post("", response_model=TaskDetailRead, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, user: CurrentUser, db: Session = Depends(get_db)) -> TaskDetailRead:
    task = task_service.create_task(db, user.id, payload)
    record_created(db, task.id, user)
    return task


@router.get("/{task_id}", response_model=TaskDetailRead)
def get_task(task_id: UUID, user: CurrentUser, db: Session = Depends(get_db)) -> TaskDetailRead:
    return task_service.get_task(db, user.id, task_id)


@router.get("/{task_id}/history", response_model=list[TaskHistoryRead])
def get_task_history(task_id: UUID, user: CurrentUser, db: Session = Depends(get_db)) -> list[TaskHistoryRead]:
    """Who changed what on the task and when, newest first."""
    return task_history_service.list_history(db, user.id, task_id)


@router.patch("/{task_id}", response_model=TaskDetailRead)
def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    user: CurrentUser,
    db: Session = Depends(get_db),
) -> TaskDetailRead:
    with track_changes(db, user, *_with_parent(db, task_id)):
        task = task_service.update_task(db, user.id, task_id, payload)
    return task


@router.patch("/{task_id}/move", response_model=TaskDetailRead)
def move_task(
    task_id: UUID,
    payload: TaskMove,
    user: CurrentUser,
    db: Session = Depends(get_db),
) -> TaskDetailRead:
    with track_changes(db, user, *_with_parent(db, task_id)):
        task = task_ordering_service.move_task(db, user.id, task_id, payload)
    return task


@router.post("/{task_id}/duplicate", response_model=TaskDetailRead, status_code=status.HTTP_201_CREATED)
def duplicate_task(task_id: UUID, user: CurrentUser, db: Session = Depends(get_db)) -> TaskDetailRead:
    """Copy the task (content, links, sub-tasks, files) right below the original, unassigned."""
    copy = task_transfer_service.duplicate_task(db, user.id, task_id)
    record_created(db, copy.id, user)
    return copy


@router.post("/{task_id}/move-to-board", response_model=TaskDetailRead)
def move_task_to_board(
    task_id: UUID,
    payload: TaskMoveToBoard,
    user: CurrentUser,
    db: Session = Depends(get_db),
) -> TaskDetailRead:
    """Move the task to another board; assignees stay only if they are on that board too."""
    with track_changes(db, user, task_id):
        task = task_transfer_service.move_to_board(db, user.id, task_id, payload)
    return task


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
    with track_changes(db, user, task_id):
        attachment = await attachment_service.upload_attachment(db, user.id, task_id, file)
    return attachment


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
    with track_changes(db, user, task_id):
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
    with track_changes(db, user, task_id):
        subtask = subtask_service.create_subtask(db, user.id, task_id, payload)
    record_created(db, subtask.id, user)
    return subtask


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
    with track_changes(db, user, task_id, subtask_id):
        subtask = subtask_service.update_subtask(db, user.id, task_id, subtask_id, payload)
    return subtask


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
    with track_changes(db, user, task_id):
        subtask_service.delete_subtask(db, user.id, task_id, subtask_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
