from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.schemas.calendar import CalendarTaskList
from app.services import calendar_service

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/tasks", response_model=CalendarTaskList)
def list_calendar_tasks(
    user: CurrentUser,
    start_date: date = Query(..., description="First visible day, YYYY-MM-DD (inclusive)"),
    end_date: date = Query(..., description="Last visible day, YYYY-MM-DD (inclusive)"),
    board_id: UUID | None = Query(default=None),
    limit: int = Query(
        default=calendar_service.CALENDAR_DEFAULT_LIMIT,
        ge=1,
        le=calendar_service.CALENDAR_MAX_LIMIT,
    ),
    db: Session = Depends(get_db),
) -> CalendarTaskList:
    """Tasks due in the visible calendar range, across every active board you can access."""
    return calendar_service.list_calendar_tasks(
        db, user.id, start_date=start_date, end_date=end_date, board_id=board_id, limit=limit
    )
