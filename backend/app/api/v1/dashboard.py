from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.schemas.dashboard import DashboardSummary, DashboardTaskList
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(
    user: CurrentUser,
    today: date = Query(..., description="Local calendar date YYYY-MM-DD"),
    db: Session = Depends(get_db),
) -> DashboardSummary:
    return dashboard_service.get_dashboard_summary(db, user.id, today)


@router.get("/tasks", response_model=DashboardTaskList)
def list_tasks(
    user: CurrentUser,
    state: Literal["open", "done", "all"] = Query(default="open"),
    board_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
) -> DashboardTaskList:
    """Tasks across all boards you can access, for the task table on the Boards page."""
    return dashboard_service.list_tasks(db, user.id, state=state, board_id=board_id)
