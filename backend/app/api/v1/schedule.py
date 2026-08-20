from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.schemas.schedule import (
    ScheduleEntryCreate,
    ScheduleEntryRead,
    ScheduleEntryUpdate,
    ScheduleOccurrenceRead,
    ScheduleOccurrenceUpdate,
)
from app.services import schedule_occurrence_service, schedule_service

router = APIRouter(prefix="/schedule", tags=["schedule"])


@router.get("", response_model=list[ScheduleEntryRead])
def list_schedule_entries(
    user: CurrentUser,
    week_start: date = Query(..., description="Monday of the visible week"),
    today: date = Query(..., description="Local calendar date YYYY-MM-DD"),
    db: Session = Depends(get_db),
) -> list[ScheduleEntryRead]:
    return schedule_service.list_schedule_entries(db, user.id, week_start=week_start, today=today)


@router.post("", response_model=ScheduleEntryRead, status_code=status.HTTP_201_CREATED)
def create_schedule_entry(
    payload: ScheduleEntryCreate,
    user: CurrentUser,
    db: Session = Depends(get_db),
) -> ScheduleEntryRead:
    return schedule_service.create_schedule_entry(db, user.id, payload)


@router.get("/{entry_id}", response_model=ScheduleEntryRead)
def get_schedule_entry(entry_id: UUID, user: CurrentUser, db: Session = Depends(get_db)) -> ScheduleEntryRead:
    return schedule_service.get_schedule_entry(db, user.id, entry_id)


@router.patch("/{entry_id}", response_model=ScheduleEntryRead)
def update_schedule_entry(
    entry_id: UUID,
    payload: ScheduleEntryUpdate,
    user: CurrentUser,
    db: Session = Depends(get_db),
) -> ScheduleEntryRead:
    return schedule_service.update_schedule_entry(db, user.id, entry_id, payload)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_schedule_entry(entry_id: UUID, user: CurrentUser, db: Session = Depends(get_db)) -> Response:
    schedule_service.delete_schedule_entry(db, user.id, entry_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{entry_id}/occurrences/{occurrence_date}", response_model=ScheduleOccurrenceRead)
def set_schedule_occurrence(
    entry_id: UUID,
    occurrence_date: date,
    payload: ScheduleOccurrenceUpdate,
    user: CurrentUser,
    db: Session = Depends(get_db),
) -> ScheduleOccurrenceRead:
    return schedule_occurrence_service.set_occurrence_state(
        db, user.id, entry_id, occurrence_date, payload
    )
