from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import UNCATEGORIZED_NAME
from app.models import Board, Category
from app.schemas.category import CategoryCreate, CategoryRead
from app.services.ownership import get_board_for_user


def get_board_or_404(db: Session, user_id: uuid.UUID, board_id: uuid.UUID) -> Board:
    return get_board_for_user(db, user_id, board_id)


def get_category_or_404(db: Session, category_id: uuid.UUID) -> Category:
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return category


def ensure_category_on_board(
    db: Session,
    category_id: uuid.UUID,
    board_id: uuid.UUID,
) -> Category:
    category = get_category_or_404(db, category_id)
    if category.board_id != board_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Category does not belong to the same board as the task",
        )
    return category


def list_categories(db: Session, user_id: uuid.UUID, board_id: uuid.UUID) -> list[CategoryRead]:
    get_board_or_404(db, user_id, board_id)
    categories = list(
        db.scalars(
            select(Category).where(Category.board_id == board_id).order_by(Category.position, Category.name)
        ).all()
    )
    return [CategoryRead.model_validate(category) for category in categories]


def create_category(db: Session, user_id: uuid.UUID, board_id: uuid.UUID, payload: CategoryCreate) -> CategoryRead:
    get_board_or_404(db, user_id, board_id)
    name = payload.name.strip()
    existing = db.scalar(
        select(Category).where(
            Category.board_id == board_id,
            func.lower(Category.name) == name.lower(),
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f'A category named "{existing.name}" already exists on this board',
        )

    max_pos = db.scalar(
        select(func.coalesce(func.max(Category.position), -1)).where(Category.board_id == board_id)
    )
    assert max_pos is not None

    category = Category(
        board_id=board_id,
        name=name,
        color=payload.color,
        position=max_pos + 1,
    )
    db.add(category)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f'A category named "{name}" already exists on this board',
        ) from None
    db.refresh(category)
    return CategoryRead.model_validate(category)


def get_uncategorized_id(db: Session, board_id: uuid.UUID) -> uuid.UUID:
    category = db.scalar(
        select(Category).where(
            Category.board_id == board_id,
            func.lower(Category.name) == UNCATEGORIZED_NAME.lower(),
        )
    )
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Uncategorized category is missing for this board",
        )
    return category.id
