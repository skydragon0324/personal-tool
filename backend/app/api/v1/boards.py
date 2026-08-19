from datetime import date as date_type
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.board import BoardView
from app.services import board_service

router = APIRouter(prefix="/boards", tags=["boards"])


@router.get("/{board_id}/view", response_model=BoardView)
def get_board_view(
    board_id: UUID,
    date: date_type | None = Query(default=None, description="Legacy single day (YYYY-MM-DD)"),
    start_date: date_type | None = Query(default=None),
    end_date: date_type | None = Query(default=None),
    db: Session = Depends(get_db),
) -> BoardView:
    return board_service.get_board_view(
        db,
        board_id,
        start_date=start_date,
        end_date=end_date,
        legacy_date=date,
    )
