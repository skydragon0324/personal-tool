from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models.schedule_entry import ScheduleEntry
from app.schemas.schedule import ScheduleEntryCreate, ScheduleEntryRead, ScheduleEntryUpdate


def monday_on_or_before(day: date) -> date:
    return day - timedelta(days=day.weekday())


def get_entry_or_404(db: Session, entry_id: uuid.UUID) -> ScheduleEntry:
    entry = db.get(ScheduleEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule entry not found")
    return entry


def list_schedule_entries(
    db: Session,
    *,
    week_start: date,
    today: date,
) -> list[ScheduleEntryRead]:
    if week_start.weekday() != 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="week_start must be a Monday",
        )
    current_week = monday_on_or_before(today)
    filters = [ScheduleEntry.kind == "routine"]
    if week_start >= current_week:
        filters.append(
            and_(ScheduleEntry.kind == "this_week", ScheduleEntry.week_start == week_start)
        )
    entries = list(
        db.scalars(
            select(ScheduleEntry)
            .where(or_(*filters))
            .order_by(ScheduleEntry.start_time, ScheduleEntry.title)
        ).all()
    )
    return [ScheduleEntryRead.model_validate(entry) for entry in entries]


def create_schedule_entry(db: Session, payload: ScheduleEntryCreate) -> ScheduleEntryRead:
    entry = ScheduleEntry(
        title=payload.title,
        kind=payload.kind,
        weekdays=payload.weekdays,
        week_start=payload.week_start if payload.kind == "this_week" else None,
        start_time=payload.start_time,
        end_time=payload.end_time,
        priority=payload.priority,
        color=payload.color,
        notes=payload.notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return ScheduleEntryRead.model_validate(entry)


def get_schedule_entry(db: Session, entry_id: uuid.UUID) -> ScheduleEntryRead:
    return ScheduleEntryRead.model_validate(get_entry_or_404(db, entry_id))


def update_schedule_entry(
    db: Session,
    entry_id: uuid.UUID,
    payload: ScheduleEntryUpdate,
) -> ScheduleEntryRead:
    entry = get_entry_or_404(db, entry_id)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        return ScheduleEntryRead.model_validate(entry)

    kind = data.get("kind", entry.kind)
    start_time = data.get("start_time", entry.start_time)
    end_time = data.get("end_time", entry.end_time)
    if end_time <= start_time:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_time must be later than start_time",
        )
    week_start = data.get("week_start", entry.week_start)
    if kind == "this_week" and week_start is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="week_start is required for this-week entries",
        )

    if "title" in data:
        entry.title = data["title"]
    if "kind" in data:
        entry.kind = data["kind"]
    if "weekdays" in data:
        entry.weekdays = data["weekdays"]
    if "start_time" in data:
        entry.start_time = data["start_time"]
    if "end_time" in data:
        entry.end_time = data["end_time"]
    if "priority" in data:
        entry.priority = data["priority"]
    if "color" in data:
        entry.color = data["color"]
    if "notes" in data:
        entry.notes = data["notes"]
    entry.week_start = None if kind == "routine" else week_start
    entry.updated_at = datetime.now(timezone.utc)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return ScheduleEntryRead.model_validate(entry)


def delete_schedule_entry(db: Session, entry_id: uuid.UUID) -> None:
    entry = get_entry_or_404(db, entry_id)
    db.delete(entry)
    db.commit()
