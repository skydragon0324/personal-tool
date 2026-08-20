from datetime import date as date_type

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.schemas.today import TodayRead
from app.services import today_service

router = APIRouter(prefix="/today", tags=["today"])


@router.get("", response_model=TodayRead)
def get_today(
    user: CurrentUser,
    selected: date_type = Query(..., alias="date", description="Local calendar date YYYY-MM-DD"),
    db: Session = Depends(get_db),
) -> TodayRead:
    return today_service.get_today(db, user.id, selected)
