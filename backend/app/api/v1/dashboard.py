from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.dashboard import DashboardSummary
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(
    today: date = Query(..., description="Local calendar date YYYY-MM-DD"),
    db: Session = Depends(get_db),
) -> DashboardSummary:
    return dashboard_service.get_dashboard_summary(db, today)
