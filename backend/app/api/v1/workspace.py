from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.schemas.workspace import (
    BoardFolderRead,
    BoardFolderWrite,
    InboxItemCreate,
    InboxItemRead,
    InboxItemUpdate,
)
from app.services import workspace_service

router = APIRouter(tags=["workspace"])


@router.get("/board-folders", response_model=list[BoardFolderRead])
def list_folders(user: CurrentUser, db: Session = Depends(get_db)):
    return workspace_service.list_folders(db, user.id)


@router.post("/board-folders", response_model=BoardFolderRead, status_code=status.HTTP_201_CREATED)
def create_folder(payload: BoardFolderWrite, user: CurrentUser, db: Session = Depends(get_db)):
    return workspace_service.create_folder(db, user.id, payload)


@router.patch("/board-folders/{folder_id}", response_model=BoardFolderRead)
def rename_folder(
    folder_id: UUID, payload: BoardFolderWrite, user: CurrentUser, db: Session = Depends(get_db)
):
    return workspace_service.rename_folder(db, user.id, folder_id, payload)


@router.delete("/board-folders/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_folder(folder_id: UUID, user: CurrentUser, db: Session = Depends(get_db)) -> Response:
    workspace_service.delete_folder(db, user.id, folder_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/inbox", response_model=list[InboxItemRead])
def list_inbox(user: CurrentUser, db: Session = Depends(get_db)):
    return workspace_service.list_inbox(db, user.id)


@router.post("/inbox", response_model=InboxItemRead, status_code=status.HTTP_201_CREATED)
def create_inbox_item(payload: InboxItemCreate, user: CurrentUser, db: Session = Depends(get_db)):
    return workspace_service.create_inbox_item(db, user.id, payload)


@router.patch("/inbox/{item_id}", response_model=InboxItemRead)
def update_inbox_item(
    item_id: UUID, payload: InboxItemUpdate, user: CurrentUser, db: Session = Depends(get_db)
):
    return workspace_service.update_inbox_item(db, user.id, item_id, payload)


@router.delete("/inbox/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_inbox_item(item_id: UUID, user: CurrentUser, db: Session = Depends(get_db)) -> Response:
    workspace_service.delete_inbox_item(db, user.id, item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
