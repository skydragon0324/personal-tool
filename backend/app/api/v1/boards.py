from datetime import date as date_type
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.board import BoardCreate, BoardRead, BoardReorder, BoardUpdate, BoardView
from app.schemas.category import CategoryCreate, CategoryRead
from app.schemas.column import ColumnCreate, ColumnRead
from app.services import board_service, category_service, column_service

router = APIRouter(prefix="/boards", tags=["boards"])


@router.get("", response_model=list[BoardRead])
def list_boards(
    include_archived: bool = Query(default=True),
    db: Session = Depends(get_db),
) -> list[BoardRead]:
    return board_service.list_boards(db, include_archived=include_archived)


@router.post("", response_model=BoardRead, status_code=status.HTTP_201_CREATED)
def create_board(payload: BoardCreate, db: Session = Depends(get_db)) -> BoardRead:
    return board_service.create_board(db, payload)


@router.get("/{board_id}", response_model=BoardRead)
def get_board(board_id: UUID, db: Session = Depends(get_db)) -> BoardRead:
    return board_service.get_board(db, board_id)


@router.patch("/{board_id}", response_model=BoardRead)
def update_board(
    board_id: UUID,
    payload: BoardUpdate,
    db: Session = Depends(get_db),
) -> BoardRead:
    return board_service.update_board(db, board_id, payload)


@router.patch("/{board_id}/reorder", response_model=BoardRead)
def reorder_board(
    board_id: UUID,
    payload: BoardReorder,
    db: Session = Depends(get_db),
) -> BoardRead:
    return board_service.reorder_board(db, board_id, payload)


@router.post("/{board_id}/archive", response_model=BoardRead)
def archive_board(board_id: UUID, db: Session = Depends(get_db)) -> BoardRead:
    return board_service.archive_board(db, board_id)


@router.post("/{board_id}/restore", response_model=BoardRead)
def restore_board(board_id: UUID, db: Session = Depends(get_db)) -> BoardRead:
    return board_service.restore_board(db, board_id)


@router.delete("/{board_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_board(board_id: UUID, db: Session = Depends(get_db)) -> Response:
    board_service.delete_board(db, board_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{board_id}/view", response_model=BoardView)
def get_board_view(
    board_id: UUID,
    date: date_type | None = Query(default=None, description="Legacy single day (YYYY-MM-DD)"),
    start_date: date_type | None = Query(default=None),
    end_date: date_type | None = Query(default=None),
    date_field: Literal["due_date", "created_at"] = Query(default="due_date"),
    unbounded: bool = Query(default=False),
    limit: int = Query(default=500, ge=1, le=500),
    db: Session = Depends(get_db),
) -> BoardView:
    return board_service.get_board_view(
        db,
        board_id,
        start_date=start_date,
        end_date=end_date,
        legacy_date=date,
        date_field=date_field,
        unbounded=unbounded,
        limit=limit,
    )


@router.get("/{board_id}/categories", response_model=list[CategoryRead])
def list_categories(board_id: UUID, db: Session = Depends(get_db)) -> list[CategoryRead]:
    return category_service.list_categories(db, board_id)


@router.post(
    "/{board_id}/categories",
    response_model=CategoryRead,
    status_code=status.HTTP_201_CREATED,
)
def create_category(
    board_id: UUID,
    payload: CategoryCreate,
    db: Session = Depends(get_db),
) -> CategoryRead:
    return category_service.create_category(db, board_id, payload)


@router.get("/{board_id}/columns", response_model=list[ColumnRead])
def list_columns(
    board_id: UUID,
    include_archived: bool = Query(default=True),
    db: Session = Depends(get_db),
) -> list[ColumnRead]:
    return column_service.list_columns(db, board_id, include_archived=include_archived)


@router.post(
    "/{board_id}/columns",
    response_model=ColumnRead,
    status_code=status.HTTP_201_CREATED,
)
def create_column(
    board_id: UUID,
    payload: ColumnCreate,
    db: Session = Depends(get_db),
) -> ColumnRead:
    return column_service.create_column(db, board_id, payload)
