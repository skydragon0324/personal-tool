from __future__ import annotations

from datetime import date, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.constants import COLUMN_DONE_ID, COLUMN_TODO_ID, DEFAULT_BOARD_ID
from app.models import Task


def test_dashboard_summary_counts_active_boards_by_status(
    client: TestClient,
    seed_tasks: list[Task],
    db: Session,
    today: date,
    uncategorized_id,
) -> None:
    overdue = Task(
        id=uuid4(),
        column_id=COLUMN_TODO_ID,
        category_id=uncategorized_id,
        title="Overdue item",
        start_date=today - timedelta(days=3),
        due_date=today - timedelta(days=3),
        priority="high",
        position=10,
        version=1,
    )
    completed = Task(
        id=uuid4(),
        column_id=COLUMN_DONE_ID,
        category_id=uncategorized_id,
        title="Finished item",
        start_date=today,
        due_date=today,
        priority="low",
        position=0,
        version=1,
    )
    db.add_all([overdue, completed])
    db.commit()

    extra = client.post("/api/v1/boards", json={"name": f"Dash-{uuid4().hex[:8]}", "timezone": "UTC"})
    assert extra.status_code == 201, extra.text
    client.post(f"/api/v1/boards/{extra.json()['id']}/archive")

    response = client.get("/api/v1/dashboard/summary", params={"today": today.isoformat()})
    assert response.status_code == 200, response.text
    body = response.json()
    personal = next(item for item in body["boards"] if item["id"] == str(DEFAULT_BOARD_ID))
    assert body["today"] == today.isoformat()
    assert extra.json()["id"] not in {item["id"] for item in body["boards"]}
    assert personal["total"] == 5
    assert personal["open"] == 4
    assert personal["completed"] == 1
    assert personal["overdue"] == 1
    assert personal["due_today"] == 3
    assert personal["status_count"] >= 3
    assert body["total_tasks"] >= 5
    assert body["completed_tasks"] >= 1
    assert body["overdue"] >= 1
    assert body["due_today"] >= 3
    assert body["priority"]["high"] >= 2
    assert any(item["title"] == "Overdue item" for item in body["attention"]["overdue"])
    assert {item["title"] for item in body["attention"]["due_today"]} <= {
        "Alpha",
        "Bravo",
        "Charlie",
        "Finished item",
    }
    assert "Finished item" not in {item["title"] for item in body["attention"]["due_today"]}


def test_dashboard_requires_today(client: TestClient) -> None:
    response = client.get("/api/v1/dashboard/summary")
    assert response.status_code == 422
