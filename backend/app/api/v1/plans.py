from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.schemas.plan import (
    PlanCreate,
    PlanDayCreate,
    PlanDayRead,
    PlanDayUpdate,
    PlanDetail,
    PlanItemCreate,
    PlanItemRead,
    PlanItemUpdate,
    PlanOverview,
    PlanRead,
    PlanUpdate,
)
from app.services import plan_service

router = APIRouter(tags=["plans"])


@router.get("/plans", response_model=list[PlanRead])
def list_plans(user: CurrentUser, db: Session = Depends(get_db)) -> list[PlanRead]:
    return plan_service.list_plans(db, user.id)


@router.post("/plans", response_model=PlanDetail, status_code=status.HTTP_201_CREATED)
def create_plan(payload: PlanCreate, user: CurrentUser, db: Session = Depends(get_db)) -> PlanDetail:
    return plan_service.create_plan(db, user.id, payload)


@router.get("/plans/overview", response_model=PlanOverview)
def plans_overview(
    user: CurrentUser,
    today: date = Query(..., description="Local calendar date YYYY-MM-DD"),
    db: Session = Depends(get_db),
) -> PlanOverview:
    """Progress across all plans: totals, per-plan state, today's items and a daily timeline."""
    return plan_service.overview(db, user.id, today)


@router.get("/plans/{plan_id}", response_model=PlanDetail)
def get_plan(plan_id: UUID, user: CurrentUser, db: Session = Depends(get_db)) -> PlanDetail:
    return plan_service.get_plan(db, user.id, plan_id)


@router.patch("/plans/{plan_id}", response_model=PlanDetail)
def update_plan(
    plan_id: UUID, payload: PlanUpdate, user: CurrentUser, db: Session = Depends(get_db)
) -> PlanDetail:
    return plan_service.update_plan(db, user.id, plan_id, payload)


@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plan(plan_id: UUID, user: CurrentUser, db: Session = Depends(get_db)) -> Response:
    plan_service.delete_plan(db, user.id, plan_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/plans/{plan_id}/days", response_model=PlanDayRead, status_code=status.HTTP_201_CREATED)
def create_day(
    plan_id: UUID, payload: PlanDayCreate, user: CurrentUser, db: Session = Depends(get_db)
) -> PlanDayRead:
    return plan_service.create_day(db, user.id, plan_id, payload)


@router.patch("/plan-days/{day_id}", response_model=PlanDayRead)
def update_day(
    day_id: UUID, payload: PlanDayUpdate, user: CurrentUser, db: Session = Depends(get_db)
) -> PlanDayRead:
    return plan_service.update_day(db, user.id, day_id, payload)


@router.delete("/plan-days/{day_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_day(day_id: UUID, user: CurrentUser, db: Session = Depends(get_db)) -> Response:
    plan_service.delete_day(db, user.id, day_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/plan-days/{day_id}/items", response_model=PlanItemRead, status_code=status.HTTP_201_CREATED)
def create_item(
    day_id: UUID, payload: PlanItemCreate, user: CurrentUser, db: Session = Depends(get_db)
) -> PlanItemRead:
    return plan_service.create_item(db, user.id, day_id, payload)


@router.patch("/plan-items/{item_id}", response_model=PlanItemRead)
def update_item(
    item_id: UUID, payload: PlanItemUpdate, user: CurrentUser, db: Session = Depends(get_db)
) -> PlanItemRead:
    return plan_service.update_item(db, user.id, item_id, payload)


@router.delete("/plan-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: UUID, user: CurrentUser, db: Session = Depends(get_db)) -> Response:
    plan_service.delete_item(db, user.id, item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
