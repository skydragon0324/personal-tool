from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.schedule import ScheduleEntryCreate, ScheduleEntryRead, ScheduleEntryUpdate
from app.services import schedule_service

router = APIRouter(prefix="/schedule", tags=["schedule"])


@router.get("", response_model=list[ScheduleEntryRead])
def list_schedule_entries(
    week_start: date = Query(..., description="Monday of the visible week"),
    today: date = Query(..., description="Local calendar date YYYY-MM-DD"),
    db: Session = Depends(get_db),
) -> list[ScheduleEntryRead]:
    return schedule_service.list_schedule_entries(db, week_start=week_start, today=today)


@router.post("", response_model=ScheduleEntryRead, status_code=status.HTTP_201_CREATED)
def create_schedule_entry(
    payload: ScheduleEntryCreate,
    db: Session = Depends(get_db),
) -> ScheduleEntryRead:
    return schedule_service.create_schedule_entry(db, payload)


@router.get("/{entry_id}", response_model=ScheduleEntryRead)
def get_schedule_entry(entry_id: UUID, db: Session = Depends(get_db)) -> ScheduleEntryRead:
    return schedule_service.get_schedule_entry(db, entry_id)


@router.patch("/{entry_id}", response_model=ScheduleEntryRead)
def update_schedule_entry(
    entry_id: UUID,
    payload: ScheduleEntryUpdate,
    db: Session = Depends(get_db),
) -> ScheduleEntryRead:
    return schedule_service.update_schedule_entry(db, entry_id, payload)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_schedule_entry(entry_id: UUID, db: Session = Depends(get_db)) -> Response:
    schedule_service.delete_schedule_entry(db, entry_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
