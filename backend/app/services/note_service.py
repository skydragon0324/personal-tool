from __future__ import annotations

import uuid
from datetime import datetime, timezone

from datetime import datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.note import Note
from app.schemas.note import NoteCreate, NoteRead, NoteUpdate
from app.services.ownership import get_note_for_user


def get_note_or_404(db: Session, user_id: uuid.UUID, note_id: uuid.UUID) -> Note:
    return get_note_for_user(db, user_id, note_id)


def list_notes(
    db: Session,
    user_id: uuid.UUID,
    query: str | None = None,
    priority: str | None = None,
    pinned: bool | None = None,
) -> list[NoteRead]:
    stmt = select(Note).where(Note.user_id == user_id)
    needle = (query or "").strip()
    if needle:
        pattern = f"%{needle}%"
        stmt = stmt.where(or_(Note.title.ilike(pattern), Note.body.ilike(pattern)))
    if priority is not None:
        stmt = stmt.where(Note.priority == priority)
    if pinned is not None:
        stmt = stmt.where(Note.is_pinned.is_(pinned))
    stmt = stmt.order_by(Note.is_pinned.desc(), Note.updated_at.desc(), Note.created_at.desc())
    notes = list(db.scalars(stmt).all())
    return [NoteRead.model_validate(note) for note in notes]


def create_note(db: Session, user_id: uuid.UUID, payload: NoteCreate) -> NoteRead:
    note = Note(
        user_id=user_id,
        title=payload.title,
        body=payload.body,
        priority=payload.priority,
        is_pinned=payload.is_pinned,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return NoteRead.model_validate(note)


def get_note(db: Session, user_id: uuid.UUID, note_id: uuid.UUID) -> NoteRead:
    return NoteRead.model_validate(get_note_or_404(db, user_id, note_id))


def update_note(db: Session, user_id: uuid.UUID, note_id: uuid.UUID, payload: NoteUpdate) -> NoteRead:
    note = get_note_or_404(db, user_id, note_id)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        return NoteRead.model_validate(note)
    if "title" in data:
        note.title = data["title"]
    if "body" in data:
        note.body = data["body"]
    if "priority" in data:
        note.priority = data["priority"]
    if "is_pinned" in data:
        note.is_pinned = data["is_pinned"]
    note.updated_at = datetime.now(timezone.utc)
    db.add(note)
    db.commit()
    db.refresh(note)
    return NoteRead.model_validate(note)


def delete_note(db: Session, user_id: uuid.UUID, note_id: uuid.UUID) -> None:
    note = get_note_or_404(db, user_id, note_id)
    db.delete(note)
    db.commit()
