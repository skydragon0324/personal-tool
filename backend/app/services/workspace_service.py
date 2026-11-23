"""Board folders and the personal inbox."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Board, BoardFolder, InboxItem
from app.schemas.workspace import BoardFolderWrite, InboxItemCreate, InboxItemUpdate

FOLDER_NAME_TAKEN = "A folder with that name already exists"


def get_folder_or_404(db: Session, user_id: uuid.UUID, folder_id: uuid.UUID) -> BoardFolder:
    folder = db.scalar(
        select(BoardFolder).where(BoardFolder.id == folder_id, BoardFolder.user_id == user_id)
    )
    if folder is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")
    return folder


def _ensure_folder_name_free(
    db: Session, user_id: uuid.UUID, name: str, exclude_id: uuid.UUID | None = None
) -> None:
    query = select(BoardFolder.id).where(
        BoardFolder.user_id == user_id, func.lower(BoardFolder.name) == name.lower()
    )
    if exclude_id is not None:
        query = query.where(BoardFolder.id != exclude_id)
    if db.scalar(query) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=FOLDER_NAME_TAKEN)


def _commit_folder(db: Session, folder: BoardFolder) -> BoardFolder:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=FOLDER_NAME_TAKEN) from None
    db.refresh(folder)
    return folder


def list_folders(db: Session, user_id: uuid.UUID) -> list[BoardFolder]:
    return list(
        db.scalars(
            select(BoardFolder)
            .where(BoardFolder.user_id == user_id)
            .order_by(BoardFolder.position, func.lower(BoardFolder.name))
        ).all()
    )


def create_folder(db: Session, user_id: uuid.UUID, payload: BoardFolderWrite) -> BoardFolder:
    _ensure_folder_name_free(db, user_id, payload.name)
    last = db.scalar(
        select(func.coalesce(func.max(BoardFolder.position), -1)).where(BoardFolder.user_id == user_id)
    )
    folder = BoardFolder(user_id=user_id, name=payload.name, position=int(last) + 1)
    db.add(folder)
    return _commit_folder(db, folder)


def rename_folder(
    db: Session, user_id: uuid.UUID, folder_id: uuid.UUID, payload: BoardFolderWrite
) -> BoardFolder:
    folder = get_folder_or_404(db, user_id, folder_id)
    _ensure_folder_name_free(db, user_id, payload.name, exclude_id=folder.id)
    folder.name = payload.name
    folder.updated_at = datetime.now(UTC)
    return _commit_folder(db, folder)


def delete_folder(db: Session, user_id: uuid.UUID, folder_id: uuid.UUID) -> None:
    """Removes only the folder: its boards and their tasks stay and become ungrouped."""
    folder = get_folder_or_404(db, user_id, folder_id)
    db.execute(update(Board).where(Board.folder_id == folder.id).values(folder_id=None))
    db.delete(folder)
    db.commit()


def _inbox_item_or_404(db: Session, user_id: uuid.UUID, item_id: uuid.UUID) -> InboxItem:
    item = db.scalar(select(InboxItem).where(InboxItem.id == item_id, InboxItem.user_id == user_id))
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inbox item not found")
    return item


def list_inbox(db: Session, user_id: uuid.UUID) -> list[InboxItem]:
    return list(
        db.scalars(
            select(InboxItem)
            .where(InboxItem.user_id == user_id)
            .order_by(InboxItem.is_processed, InboxItem.created_at.desc())
        ).all()
    )


def create_inbox_item(db: Session, user_id: uuid.UUID, payload: InboxItemCreate) -> InboxItem:
    item = InboxItem(user_id=user_id, title=payload.title, details=payload.details)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_inbox_item(
    db: Session, user_id: uuid.UUID, item_id: uuid.UUID, payload: InboxItemUpdate
) -> InboxItem:
    item = _inbox_item_or_404(db, user_id, item_id)
    if payload.title is not None:
        item.title = payload.title
    if payload.details is not None:
        item.details = payload.details
    if payload.is_processed is not None and payload.is_processed != item.is_processed:
        item.is_processed = payload.is_processed
        item.processed_at = datetime.now(UTC) if payload.is_processed else None
    item.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(item)
    return item


def delete_inbox_item(db: Session, user_id: uuid.UUID, item_id: uuid.UUID) -> None:
    db.delete(_inbox_item_or_404(db, user_id, item_id))
    db.commit()
