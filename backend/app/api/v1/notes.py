from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.note import NoteCreate, NoteRead, NoteUpdate
from app.services import note_service

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("", response_model=list[NoteRead])
def list_notes(
    query: str | None = Query(default=None),
    priority: Literal["low", "medium", "high"] | None = Query(default=None),
    pinned: bool | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[NoteRead]:
    return note_service.list_notes(db, query=query, priority=priority, pinned=pinned)


@router.post("", response_model=NoteRead, status_code=status.HTTP_201_CREATED)
def create_note(payload: NoteCreate, db: Session = Depends(get_db)) -> NoteRead:
    return note_service.create_note(db, payload)


@router.get("/{note_id}", response_model=NoteRead)
def get_note(note_id: UUID, db: Session = Depends(get_db)) -> NoteRead:
    return note_service.get_note(db, note_id)


@router.patch("/{note_id}", response_model=NoteRead)
def update_note(note_id: UUID, payload: NoteUpdate, db: Session = Depends(get_db)) -> NoteRead:
    return note_service.update_note(db, note_id, payload)


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: UUID, db: Session = Depends(get_db)) -> Response:
    note_service.delete_note(db, note_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
