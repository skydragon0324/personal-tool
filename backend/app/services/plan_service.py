"""Plans: named collections of day plans, each holding checkbox items.

Plans are owned by a user and are independent of boards and tasks.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models import Plan, PlanDay, PlanItem
from app.schemas.plan import (
    PlanCreate,
    PlanDayCreate,
    PlanDayRead,
    PlanDayUpdate,
    PlanDetail,
    PlanItemCreate,
    PlanItemRead,
    PlanBehindDay,
    PlanInsight,
    PlanItemUpdate,
    PlanOverview,
    PlanOverviewTotals,
    PlanRead,
    PlanTimelinePoint,
    PlanTodayItem,
    PlanUpdate,
)


def _not_found(label: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{label} not found")


def _duplicate_day() -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This plan already has that day")


def _get_plan(db: Session, user_id: uuid.UUID, plan_id: uuid.UUID, *, with_days: bool = False) -> Plan:
    query = select(Plan).where(Plan.id == plan_id, Plan.user_id == user_id)
    if with_days:
        query = query.options(selectinload(Plan.days).selectinload(PlanDay.items))
    plan = db.scalar(query)
    if plan is None:
        raise _not_found("Plan")
    return plan


def _get_day(db: Session, user_id: uuid.UUID, day_id: uuid.UUID) -> PlanDay:
    day = db.scalar(
        select(PlanDay)
        .join(Plan, Plan.id == PlanDay.plan_id)
        .where(PlanDay.id == day_id, Plan.user_id == user_id)
        .options(selectinload(PlanDay.items))
    )
    if day is None:
        raise _not_found("Day")
    return day


def _get_item(db: Session, user_id: uuid.UUID, item_id: uuid.UUID) -> PlanItem:
    item = db.scalar(
        select(PlanItem)
        .join(PlanDay, PlanDay.id == PlanItem.day_id)
        .join(Plan, Plan.id == PlanDay.plan_id)
        .where(PlanItem.id == item_id, Plan.user_id == user_id)
    )
    if item is None:
        raise _not_found("Item")
    return item


def _touch_plan(db: Session, plan_id: uuid.UUID) -> None:
    plan = db.get(Plan, plan_id)
    if plan is not None:
        plan.updated_at = datetime.now(UTC)


def _to_read(plan: Plan, stats: tuple[int, int, int, object, object]) -> PlanRead:
    day_count, item_count, completed_count, first_day, last_day = stats
    return PlanRead(
        id=plan.id,
        name=plan.name,
        description=plan.description,
        position=plan.position,
        day_count=day_count,
        item_count=item_count,
        completed_count=completed_count,
        first_day=first_day,
        last_day=last_day,
        created_at=plan.created_at,
        updated_at=plan.updated_at,
    )


def _stats(db: Session, plan_ids: list[uuid.UUID]) -> dict[uuid.UUID, tuple[int, int, int, object, object]]:
    if not plan_ids:
        return {}
    day_rows = db.execute(
        select(PlanDay.plan_id, func.count(PlanDay.id), func.min(PlanDay.day), func.max(PlanDay.day))
        .where(PlanDay.plan_id.in_(plan_ids))
        .group_by(PlanDay.plan_id)
    ).all()
    item_rows = db.execute(
        select(
            PlanDay.plan_id,
            func.count(PlanItem.id),
            func.count(PlanItem.id).filter(PlanItem.is_completed.is_(True)),
        )
        .join(PlanItem, PlanItem.day_id == PlanDay.id)
        .where(PlanDay.plan_id.in_(plan_ids))
        .group_by(PlanDay.plan_id)
    ).all()
    days = {row[0]: (int(row[1]), row[2], row[3]) for row in day_rows}
    items = {row[0]: (int(row[1]), int(row[2])) for row in item_rows}
    result = {}
    for plan_id in plan_ids:
        day_count, first_day, last_day = days.get(plan_id, (0, None, None))
        item_count, completed = items.get(plan_id, (0, 0))
        result[plan_id] = (day_count, item_count, completed, first_day, last_day)
    return result


def list_plans(db: Session, user_id: uuid.UUID) -> list[PlanRead]:
    plans = list(
        db.scalars(
            select(Plan).where(Plan.user_id == user_id).order_by(Plan.position, Plan.created_at)
        ).all()
    )
    stats = _stats(db, [plan.id for plan in plans])
    return [_to_read(plan, stats[plan.id]) for plan in plans]


def get_plan(db: Session, user_id: uuid.UUID, plan_id: uuid.UUID) -> PlanDetail:
    plan = _get_plan(db, user_id, plan_id, with_days=True)
    summary = _to_read(plan, _stats(db, [plan.id])[plan.id])
    return PlanDetail(
        **summary.model_dump(),
        days=[PlanDayRead.model_validate(day) for day in plan.days],
    )


def create_plan(db: Session, user_id: uuid.UUID, payload: PlanCreate) -> PlanDetail:
    max_pos = db.scalar(select(func.max(Plan.position)).where(Plan.user_id == user_id))
    plan = Plan(
        user_id=user_id,
        name=payload.name,
        description=payload.description,
        position=(max_pos if max_pos is not None else -1) + 1,
    )
    db.add(plan)
    db.commit()
    return get_plan(db, user_id, plan.id)


def update_plan(db: Session, user_id: uuid.UUID, plan_id: uuid.UUID, payload: PlanUpdate) -> PlanDetail:
    plan = _get_plan(db, user_id, plan_id)
    data = payload.model_dump(exclude_unset=True)
    for key in ("name", "description"):
        if data.get(key) is not None:
            setattr(plan, key, data[key])
    plan.updated_at = datetime.now(UTC)
    db.commit()
    return get_plan(db, user_id, plan_id)


def delete_plan(db: Session, user_id: uuid.UUID, plan_id: uuid.UUID) -> None:
    plan = _get_plan(db, user_id, plan_id)
    db.delete(plan)
    db.commit()


def create_day(db: Session, user_id: uuid.UUID, plan_id: uuid.UUID, payload: PlanDayCreate) -> PlanDayRead:
    plan = _get_plan(db, user_id, plan_id)
    exists = db.scalar(select(PlanDay.id).where(PlanDay.plan_id == plan.id, PlanDay.day == payload.day))
    if exists is not None:
        raise _duplicate_day()
    day = PlanDay(plan_id=plan.id, day=payload.day, title=payload.title.strip())
    db.add(day)
    plan.updated_at = datetime.now(UTC)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise _duplicate_day() from exc
    return PlanDayRead.model_validate(_get_day(db, user_id, day.id))


def update_day(db: Session, user_id: uuid.UUID, day_id: uuid.UUID, payload: PlanDayUpdate) -> PlanDayRead:
    day = _get_day(db, user_id, day_id)
    data = payload.model_dump(exclude_unset=True)
    if data.get("day") is not None and data["day"] != day.day:
        clash = db.scalar(
            select(PlanDay.id).where(PlanDay.plan_id == day.plan_id, PlanDay.day == data["day"])
        )
        if clash is not None:
            raise _duplicate_day()
        day.day = data["day"]
    if data.get("title") is not None:
        day.title = data["title"].strip()
    day.updated_at = datetime.now(UTC)
    _touch_plan(db, day.plan_id)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise _duplicate_day() from exc
    return PlanDayRead.model_validate(_get_day(db, user_id, day_id))


def delete_day(db: Session, user_id: uuid.UUID, day_id: uuid.UUID) -> None:
    day = _get_day(db, user_id, day_id)
    _touch_plan(db, day.plan_id)
    db.delete(day)
    db.commit()


def create_item(db: Session, user_id: uuid.UUID, day_id: uuid.UUID, payload: PlanItemCreate) -> PlanItemRead:
    day = _get_day(db, user_id, day_id)
    max_pos = db.scalar(select(func.max(PlanItem.position)).where(PlanItem.day_id == day.id))
    item = PlanItem(
        day_id=day.id,
        title=payload.title,
        is_completed=False,
        position=(max_pos if max_pos is not None else -1) + 1,
    )
    db.add(item)
    _touch_plan(db, day.plan_id)
    db.commit()
    db.refresh(item)
    return PlanItemRead.model_validate(item)


def update_item(db: Session, user_id: uuid.UUID, item_id: uuid.UUID, payload: PlanItemUpdate) -> PlanItemRead:
    item = _get_item(db, user_id, item_id)
    data = payload.model_dump(exclude_unset=True)
    now = datetime.now(UTC)
    if data.get("title") is not None:
        item.title = data["title"]
    if data.get("is_completed") is not None and data["is_completed"] != item.is_completed:
        item.is_completed = data["is_completed"]
        item.completed_at = now if item.is_completed else None
    item.updated_at = now
    db.commit()
    db.refresh(item)
    return PlanItemRead.model_validate(item)


def delete_item(db: Session, user_id: uuid.UUID, item_id: uuid.UUID) -> None:
    item = _get_item(db, user_id, item_id)
    db.delete(item)
    db.commit()


TIMELINE_PAST_DAYS = 13
TIMELINE_FUTURE_DAYS = 6
BEHIND_LIMIT = 8


def _rate(done: int, total: int) -> float:
    return round(done / total, 4) if total else 0.0


def overview(db: Session, user_id: uuid.UUID, today: date) -> PlanOverview:
    """Progress across all of the user's plans relative to ``today`` (the user's local date).

    Unlike boards (status columns), plans are about days: what was planned for each day, what
    got done, what is planned today and which past days were left unfinished.
    """
    plans = list(
        db.scalars(
            select(Plan)
            .where(Plan.user_id == user_id)
            .options(selectinload(Plan.days).selectinload(PlanDay.items))
            .order_by(Plan.position, Plan.created_at)
        ).all()
    )
    start = today - timedelta(days=TIMELINE_PAST_DAYS)
    end = today + timedelta(days=TIMELINE_FUTURE_DAYS)
    timeline = {start + timedelta(days=offset): [0, 0] for offset in range((end - start).days + 1)}
    insights: list[PlanInsight] = []
    today_items: list[PlanTodayItem] = []
    behind: list[PlanBehindDay] = []

    for plan in plans:
        items = [item for day in plan.days for item in day.items]
        done = sum(1 for item in items if item.is_completed)
        dates = sorted(day.day for day in plan.days)
        missed = 0
        for day in plan.days:
            open_items = sum(1 for item in day.items if not item.is_completed)
            if day.day in timeline:
                timeline[day.day][0] += len(day.items)
                timeline[day.day][1] += len(day.items) - open_items
            if day.day < today and open_items:
                missed += open_items
                behind.append(
                    PlanBehindDay(
                        plan_id=plan.id,
                        plan_name=plan.name,
                        day_id=day.id,
                        day=day.day,
                        open_items=open_items,
                        total_items=len(day.items),
                    )
                )
            if day.day == today:
                today_items.extend(
                    PlanTodayItem(
                        id=item.id,
                        title=item.title,
                        is_completed=item.is_completed,
                        plan_id=plan.id,
                        plan_name=plan.name,
                        day_id=day.id,
                    )
                    for item in day.items
                )
        if not dates:
            state = "empty"
        elif dates[0] > today:
            state = "upcoming"
        elif dates[-1] < today:
            state = "finished"
        else:
            state = "active"
        insights.append(
            PlanInsight(
                id=plan.id,
                name=plan.name,
                day_count=len(dates),
                item_count=len(items),
                completed_count=done,
                completion_rate=_rate(done, len(items)),
                first_day=dates[0] if dates else None,
                last_day=dates[-1] if dates else None,
                state=state,
                days_done=sum(1 for value in dates if value <= today),
                days_left=sum(1 for value in dates if value > today),
                missed_items=missed,
                next_day=next((value for value in dates if value >= today), None),
            )
        )

    behind.sort(key=lambda entry: entry.day, reverse=True)
    all_items = sum(insight.item_count for insight in insights)
    all_done = sum(insight.completed_count for insight in insights)
    return PlanOverview(
        today=today,
        totals=PlanOverviewTotals(
            plans=len(insights),
            active_plans=sum(1 for insight in insights if insight.state == "active"),
            days=sum(insight.day_count for insight in insights),
            items=all_items,
            completed=all_done,
            completion_rate=_rate(all_done, all_items),
            today_total=len(today_items),
            today_completed=sum(1 for item in today_items if item.is_completed),
            missed_items=sum(insight.missed_items for insight in insights),
        ),
        plans=insights,
        today_items=today_items,
        timeline=[
            PlanTimelinePoint(day=day, planned=values[0], completed=values[1])
            for day, values in sorted(timeline.items())
        ],
        behind=behind[:BEHIND_LIMIT],
    )
