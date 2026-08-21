from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.schemas.recurrence import (
    RecurrenceGenerateRequest,
    RecurrenceGenerateResult,
    RecurrenceSeriesListResponse,
    RecurrenceSeriesRead,
    RecurrenceSeriesUpdate,
    RecurrenceStatus,
)
from app.services import recurrence_service

router = APIRouter(prefix="/task-recurrence", tags=["task-recurrence"])


@router.get("", response_model=RecurrenceSeriesListResponse)
def list_series(
    user: CurrentUser,
    db: Session = Depends(get_db),
    board_id: UUID | None = Query(default=None),
    status: RecurrenceStatus | None = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
) -> RecurrenceSeriesListResponse:
    return recurrence_service.list_series(
        db,
        user.id,
        board_id=board_id,
        status=status,
        offset=offset,
        limit=limit,
    )


@router.get("/{series_id}", response_model=RecurrenceSeriesRead)
def get_series(series_id: UUID, user: CurrentUser, db: Session = Depends(get_db)) -> RecurrenceSeriesRead:
    return recurrence_service.read_series(db, user.id, series_id)


@router.patch("/{series_id}", response_model=RecurrenceSeriesRead)
def update_series(
    series_id: UUID,
    payload: RecurrenceSeriesUpdate,
    user: CurrentUser,
    db: Session = Depends(get_db),
) -> RecurrenceSeriesRead:
    return recurrence_service.update_series(db, user.id, series_id, payload)


@router.post("/{series_id}/stop", response_model=RecurrenceSeriesRead)
def stop_series(series_id: UUID, user: CurrentUser, db: Session = Depends(get_db)) -> RecurrenceSeriesRead:
    return recurrence_service.stop_series(db, user.id, series_id)


@router.post("/{series_id}/resume", response_model=RecurrenceSeriesRead)
def resume_series(series_id: UUID, user: CurrentUser, db: Session = Depends(get_db)) -> RecurrenceSeriesRead:
    return recurrence_service.resume_series(db, user.id, series_id)


@router.post("/{series_id}/generate", response_model=RecurrenceGenerateResult)
def generate_series(
    series_id: UUID,
    payload: RecurrenceGenerateRequest,
    user: CurrentUser,
    db: Session = Depends(get_db),
) -> RecurrenceGenerateResult:
    return recurrence_service.generate_for_request(db, user.id, series_id, payload.start, payload.end)
