from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import BOOTSTRAP_USER_ID, COLUMN_TODO_ID
from app.models import Task
from app.schemas.task import TaskCreate, TaskUpdate
from app.services import task_service


def test_create_defaults_start_date_to_due_date(
    db: Session, today: date, uncategorized_id
) -> None:
    created = task_service.create_task(
        db,
        BOOTSTRAP_USER_ID,
        TaskCreate(
            column_id=COLUMN_TODO_ID,
            category_id=uncategorized_id,
            title="Defaults",
            due_date=today + timedelta(days=2),
        ),
    )
    assert created.start_date == created.due_date == today + timedelta(days=2)


def test_create_rejects_start_after_due(client: TestClient, today: date) -> None:
    board = client.get("/api/v1/boards").json()[0]
    column_id = next(
        item["id"] for item in client.get(f"/api/v1/boards/{board['id']}/columns").json() if item["name"] == "To Do"
    )
    category_id = client.get(f"/api/v1/boards/{board['id']}/categories").json()[0]["id"]
    response = client.post(
        "/api/v1/tasks",
        json={
            "column_id": column_id,
            "category_id": category_id,
            "title": "Backwards",
            "start_date": (today + timedelta(days=2)).isoformat(),
            "due_date": today.isoformat(),
        },
    )
    assert response.status_code == 422


def test_update_rejects_start_after_due(
    db: Session, seed_tasks: list[Task], today: date
) -> None:
    task = seed_tasks[0]
    with pytest.raises(HTTPException) as exc:
        task_service.update_task(
            db,
            BOOTSTRAP_USER_ID,
            task.id,
            TaskUpdate(start_date=today + timedelta(days=5)),
        )
    assert exc.value.status_code == 422


def test_database_rejects_start_after_due(
    db: Session, today: date, uncategorized_id
) -> None:
    task = Task(
        column_id=COLUMN_TODO_ID,
        category_id=uncategorized_id,
        title="Illegal period",
        start_date=today + timedelta(days=1),
        due_date=today,
        priority="low",
        position=40,
        version=1,
    )
    db.add(task)
    try:
        db.flush()
        raise AssertionError("expected integrity error")
    except IntegrityError:
        db.rollback()
