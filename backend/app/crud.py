from datetime import date
from typing import Optional, Sequence

from fastapi import HTTPException, status
from sqlalchemy import case
from sqlmodel import Session, col, func, select

from app.models import Priority, Task
from app.schemas import DashboardSummary, TaskCreate, TaskUpdate


def create_task(session: Session, payload: TaskCreate) -> Task:
    task = Task.model_validate(payload)
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


def get_task(session: Session, task_id: int) -> Task:
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


def list_tasks(
    session: Session,
    *,
    due_date: Optional[date] = None,
    completed: Optional[bool] = None,
    priority: Optional[Priority] = None,
) -> Sequence[Task]:
    statement = select(Task)

    if due_date is not None:
        statement = statement.where(Task.due_date == due_date)
    if completed is not None:
        statement = statement.where(Task.completed == completed)
    if priority is not None:
        statement = statement.where(Task.priority == priority)

    priority_order = case(
        (Task.priority == Priority.high, 1),
        (Task.priority == Priority.medium, 2),
        (Task.priority == Priority.low, 3),
        else_=4,
    )
    statement = statement.order_by(
        col(Task.completed).asc(),
        priority_order.asc(),
        col(Task.due_date).asc(),
        col(Task.created_at).desc(),
    )
    return session.exec(statement).all()


def update_task(session: Session, task_id: int, payload: TaskUpdate) -> Task:
    task = get_task(session, task_id)
    updates = payload.model_dump(exclude_unset=True)

    for field, value in updates.items():
        setattr(task, field, value)

    session.add(task)
    session.commit()
    session.refresh(task)
    return task


def delete_task(session: Session, task_id: int) -> None:
    task = get_task(session, task_id)
    session.delete(task)
    session.commit()


def get_dashboard_summary(session: Session, day: date) -> DashboardSummary:
    total = session.exec(
        select(func.count()).select_from(Task).where(Task.due_date == day)
    ).one()
    completed = session.exec(
        select(func.count())
        .select_from(Task)
        .where(Task.due_date == day, Task.completed == True)  # noqa: E712
    ).one()

    return DashboardSummary(
        total_today=total,
        completed_today=completed,
        remaining_today=total - completed,
    )
