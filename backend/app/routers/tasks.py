from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlmodel import Session

from app import crud
from app.database import get_session
from app.models import Priority
from app.schemas import DashboardSummary, TaskCreate, TaskRead, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskRead])
def read_tasks(
    due_date: Optional[date] = Query(default=None, description="Filter by due date (YYYY-MM-DD)"),
    completed: Optional[bool] = Query(default=None, description="Filter by completion status"),
    priority: Optional[Priority] = Query(default=None, description="Filter by priority"),
    session: Session = Depends(get_session),
) -> list[TaskRead]:
    tasks = crud.list_tasks(
        session,
        due_date=due_date,
        completed=completed,
        priority=priority,
    )
    return list(tasks)


@router.get("/summary", response_model=DashboardSummary)
def read_summary(
    day: Optional[date] = Query(default=None, description="Day for summary (defaults to today)"),
    session: Session = Depends(get_session),
) -> DashboardSummary:
    target_day = day or date.today()
    return crud.get_dashboard_summary(session, target_day)


@router.get("/{task_id}", response_model=TaskRead)
def read_task(task_id: int, session: Session = Depends(get_session)) -> TaskRead:
    return crud.get_task(session, task_id)


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, session: Session = Depends(get_session)) -> TaskRead:
    return crud.create_task(session, payload)


@router.patch("/{task_id}", response_model=TaskRead)
def patch_task(
    task_id: int,
    payload: TaskUpdate,
    session: Session = Depends(get_session),
) -> TaskRead:
    return crud.update_task(session, task_id, payload)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_task(task_id: int, session: Session = Depends(get_session)) -> None:
    crud.delete_task(session, task_id)
