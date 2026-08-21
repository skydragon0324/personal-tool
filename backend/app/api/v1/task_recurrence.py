from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.schemas.recurrence import RecurrenceGenerateRequest, RecurrenceGenerateResult, RecurrenceSeriesRead
from app.services import recurrence_service

router = APIRouter(prefix="/task-recurrence", tags=["task-recurrence"])


@router.get("/{series_id}", response_model=RecurrenceSeriesRead)
def get_series(series_id: UUID, user: CurrentUser, db: Session = Depends(get_db)) -> RecurrenceSeriesRead:
    return recurrence_service.read_series(db, user.id, series_id)


@router.post("/{series_id}/stop", response_model=RecurrenceSeriesRead)
def stop_series(series_id: UUID, user: CurrentUser, db: Session = Depends(get_db)) -> RecurrenceSeriesRead:
    return recurrence_service.stop_series(db, user.id, series_id)


@router.post("/{series_id}/generate", response_model=RecurrenceGenerateResult)
def generate_series(
    series_id: UUID,
    payload: RecurrenceGenerateRequest,
    user: CurrentUser,
    db: Session = Depends(get_db),
) -> RecurrenceGenerateResult:
    return recurrence_service.generate_for_request(db, user.id, series_id, payload.start, payload.end)
