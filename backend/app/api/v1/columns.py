from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.column import ColumnArchive, ColumnRead, ColumnReorder, ColumnUpdate
from app.services import column_service

router = APIRouter(prefix="/columns", tags=["columns"])


@router.patch("/{column_id}", response_model=ColumnRead)
def update_column(
    column_id: UUID,
    payload: ColumnUpdate,
    db: Session = Depends(get_db),
) -> ColumnRead:
    return column_service.update_column(db, column_id, payload)


@router.patch("/{column_id}/reorder", response_model=ColumnRead)
def reorder_column(
    column_id: UUID,
    payload: ColumnReorder,
    db: Session = Depends(get_db),
) -> ColumnRead:
    return column_service.reorder_column(db, column_id, payload)


@router.post("/{column_id}/archive", response_model=ColumnRead)
def archive_column(
    column_id: UUID,
    payload: ColumnArchive,
    db: Session = Depends(get_db),
) -> ColumnRead:
    return column_service.archive_column(db, column_id, payload)


@router.post("/{column_id}/restore", response_model=ColumnRead)
def restore_column(column_id: UUID, db: Session = Depends(get_db)) -> ColumnRead:
    return column_service.restore_column(db, column_id)


@router.delete("/{column_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_column(column_id: UUID, db: Session = Depends(get_db)) -> Response:
    column_service.delete_column(db, column_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
