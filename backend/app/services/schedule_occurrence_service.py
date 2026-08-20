from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import ScheduleEntry, ScheduleOccurrenceState
from app.schemas.schedule import ScheduleOccurrenceRead, ScheduleOccurrenceUpdate
from app.services.schedule_service import get_entry_or_404, monday_on_or_before


def entry_occurs_on(entry: ScheduleEntry, day: date) -> bool:
    weekday = day.weekday()
    if weekday not in (entry.weekdays or []):
        return False
    if entry.kind == "routine":
        return True
    return entry.kind == "this_week" and entry.week_start == monday_on_or_before(day)


def prune_old_occurrence_states(db: Session, user_id: uuid.UUID, today: date) -> None:
    cutoff = monday_on_or_before(today)
    db.execute(
        delete(ScheduleOccurrenceState).where(
            ScheduleOccurrenceState.user_id == user_id,
            ScheduleOccurrenceState.occurrence_date < cutoff,
        )
    )


def set_occurrence_state(
    db: Session,
    user_id: uuid.UUID,
    entry_id: uuid.UUID,
    occurrence_date: date,
    payload: ScheduleOccurrenceUpdate,
) -> ScheduleOccurrenceRead:
    entry = get_entry_or_404(db, user_id, entry_id)
    if not entry_occurs_on(entry, occurrence_date):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Schedule does not occur on this date",
        )

    state = db.scalar(
        select(ScheduleOccurrenceState).where(
            ScheduleOccurrenceState.schedule_entry_id == entry_id,
            ScheduleOccurrenceState.occurrence_date == occurrence_date,
        )
    )
    now = datetime.now(UTC)
    if state is None:
        state = ScheduleOccurrenceState(
            user_id=user_id,
            schedule_entry_id=entry_id,
            occurrence_date=occurrence_date,
        )
        db.add(state)

    state.is_completed = payload.is_completed
    state.completed_at = now if payload.is_completed else None
    state.updated_at = now
    db.commit()
    db.refresh(state)
    return ScheduleOccurrenceRead(
        schedule_entry_id=state.schedule_entry_id,
        occurrence_date=state.occurrence_date,
        is_completed=state.is_completed,
        completed_at=state.completed_at,
    )
