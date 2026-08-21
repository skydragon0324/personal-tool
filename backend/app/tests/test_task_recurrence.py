from __future__ import annotations

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.main import app
from app.models import Task
from app.tests.auth_helpers import bind_client, register_user

FRIDAY = date(2026, 8, 21)


def _board_todo_category(client: TestClient) -> tuple[str, str, str]:
    boards = client.get("/api/v1/boards").json()
    board_id = boards[0]["id"]
    columns = client.get(f"/api/v1/boards/{board_id}/columns").json()
    todo = next(item["id"] for item in columns if not item["is_done"])
    done = next(item["id"] for item in columns if item["is_done"])
    category = client.get(f"/api/v1/boards/{board_id}/categories").json()[0]["id"]
    return todo, done, category


def test_create_weekly_task_materializes_occurrences(client: TestClient, db: Session) -> None:
    column_id, _done_id, category_id = _board_todo_category(client)
    created = client.post(
        "/api/v1/tasks",
        json={
            "column_id": column_id,
            "category_id": category_id,
            "title": "Weekly report",
            "start_date": FRIDAY.isoformat(),
            "due_date": FRIDAY.isoformat(),
            "priority": "medium",
            "recurrence": {"freq": "weekly", "interval": 1, "weekdays": [4]},
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["recurrence"]["freq"] == "weekly"
    assert body["recurrence"]["occurrence_date"] == FRIDAY.isoformat()
    series_id = body["recurrence"]["series_id"]

    rows = list(
        db.scalars(select(Task).where(Task.recurrence_series_id == series_id).order_by(Task.occurrence_date)).all()
    )
    dates = [item.original_occurrence_date for item in rows]
    assert FRIDAY in dates
    assert date(2026, 8, 28) in dates
    assert len(rows) >= 2

    series = client.get(f"/api/v1/task-recurrence/{series_id}")
    assert series.status_code == 200
    assert series.json()["status"] == "active"
    assert series.json()["open_count"] >= 2


def test_completing_one_occurrence_does_not_complete_the_series(client: TestClient, db: Session) -> None:
    column_id, done_id, category_id = _board_todo_category(client)
    created = client.post(
        "/api/v1/tasks",
        json={
            "column_id": column_id,
            "category_id": category_id,
            "title": "Standup",
            "start_date": FRIDAY.isoformat(),
            "due_date": FRIDAY.isoformat(),
            "recurrence": {"freq": "weekly", "interval": 1, "weekdays": [4]},
        },
    ).json()
    first_id = created["id"]
    series_id = created["recurrence"]["series_id"]
    moved = client.patch(
        f"/api/v1/tasks/{first_id}/move",
        json={"target_column_id": done_id, "expected_version": created["version"]},
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["completed_at"] is not None

    others = list(
        db.scalars(
            select(Task).where(
                Task.recurrence_series_id == series_id,
                Task.id != first_id,
            )
        ).all()
    )
    assert others
    assert all(item.completed_at is None for item in others)


def test_generate_is_idempotent_and_range_limited(client: TestClient, db: Session) -> None:
    column_id, _done_id, category_id = _board_todo_category(client)
    created = client.post(
        "/api/v1/tasks",
        json={
            "column_id": column_id,
            "category_id": category_id,
            "title": "Daily note",
            "start_date": "2026-08-20",
            "due_date": "2026-08-20",
            "recurrence": {"freq": "daily", "interval": 1, "occurrence_limit": 5},
        },
    ).json()
    series_id = created["recurrence"]["series_id"]
    first = client.post(
        f"/api/v1/task-recurrence/{series_id}/generate",
        json={"from": "2026-08-20", "to": "2026-08-24"},
    )
    assert first.status_code == 200, first.text
    second = client.post(
        f"/api/v1/task-recurrence/{series_id}/generate",
        json={"from": "2026-08-20", "to": "2026-08-24"},
    )
    assert second.status_code == 200
    assert second.json()["created"] == 0
    rows = list(db.scalars(select(Task).where(Task.recurrence_series_id == series_id)).all())
    assert len(rows) == 5
    assert {item.original_occurrence_date.isoformat() for item in rows} == {
        "2026-08-20",
        "2026-08-21",
        "2026-08-22",
        "2026-08-23",
        "2026-08-24",
    }


def test_recurrence_is_restricted_to_owner(db: Session) -> None:
    owner = bind_client(db)
    register_user(owner, email="recur-owner@example.com")
    column_id, _done_id, category_id = _board_todo_category(owner)
    created = owner.post(
        "/api/v1/tasks",
        json={
            "column_id": column_id,
            "category_id": category_id,
            "title": "Private series",
            "start_date": FRIDAY.isoformat(),
            "due_date": FRIDAY.isoformat(),
            "recurrence": {"freq": "weekly", "weekdays": [4]},
        },
    )
    assert created.status_code == 201, created.text
    series_id = created.json()["recurrence"]["series_id"]
    task_id = created.json()["id"]

    outsider = bind_client(db)
    register_user(outsider, email="recur-other@example.com")
    assert outsider.get(f"/api/v1/task-recurrence/{series_id}").status_code == 404
    assert outsider.post(f"/api/v1/task-recurrence/{series_id}/stop").status_code == 404
    stolen = outsider.patch(
        f"/api/v1/tasks/{task_id}",
        json={"title": "Hijacked", "edit_scope": "series"},
    )
    assert stolen.status_code == 404
    app.dependency_overrides.clear()


def test_delete_this_occurrence_does_not_remove_others(client: TestClient, db: Session) -> None:
    column_id, _done_id, category_id = _board_todo_category(client)
    created = client.post(
        "/api/v1/tasks",
        json={
            "column_id": column_id,
            "category_id": category_id,
            "title": "Repeating chore",
            "start_date": FRIDAY.isoformat(),
            "due_date": FRIDAY.isoformat(),
            "recurrence": {"freq": "weekly", "weekdays": [4]},
        },
    ).json()
    series_id = created["recurrence"]["series_id"]
    deleted = client.delete(f"/api/v1/tasks/{created['id']}", params={"delete_scope": "this"})
    assert deleted.status_code == 204
    remaining = list(db.scalars(select(Task).where(Task.recurrence_series_id == series_id)).all())
    assert remaining
    assert created["id"] not in {str(item.id) for item in remaining}


def test_stop_keeps_history(client: TestClient, db: Session) -> None:
    column_id, _done_id, category_id = _board_todo_category(client)
    created = client.post(
        "/api/v1/tasks",
        json={
            "column_id": column_id,
            "category_id": category_id,
            "title": "Keep history",
            "start_date": FRIDAY.isoformat(),
            "due_date": FRIDAY.isoformat(),
            "recurrence": {"freq": "weekly", "weekdays": [4]},
        },
    ).json()
    series_id = created["recurrence"]["series_id"]
    before = db.scalar(select(Task).where(Task.recurrence_series_id == series_id).limit(1))
    assert before is not None
    stopped = client.post(f"/api/v1/task-recurrence/{series_id}/stop")
    assert stopped.status_code == 200
    assert stopped.json()["status"] == "stopped"
    after = list(db.scalars(select(Task).where(Task.recurrence_series_id == series_id)).all())
    assert after
