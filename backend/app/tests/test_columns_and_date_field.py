from __future__ import annotations

from datetime import date, timedelta

from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.constants import BOOTSTRAP_USER_ID, COLUMN_DONE_ID, COLUMN_TODO_ID, DEFAULT_BOARD_ID
from app.models import Task
from app.schemas.task import TaskCreate
from app.services import board_service, task_service


def test_board_view_defaults_include_month_range_tasks(
    db: Session,
    seed_tasks: list[Task],
    today: date,
    uncategorized_id,
) -> None:
    extra = Task(
        column_id=COLUMN_TODO_ID,
        category_id=uncategorized_id,
        title="Mid month",
        due_date=date(today.year, today.month, 13) if today.day != 13 else today,
        start_date=date(today.year, today.month, 13) if today.day != 13 else today,
        priority="medium",
        position=10,
        version=1,
    )
    if extra.due_date.month != today.month:
        extra.due_date = today.replace(day=1)
        extra.start_date = extra.due_date
    db.add(extra)
    db.commit()

    start = today.replace(day=1)
    if today.month == 12:
        end = date(today.year, 12, 31)
    else:
        end = date(today.year, today.month + 1, 1) - timedelta(days=1)
    view = board_service.get_board_view(db, BOOTSTRAP_USER_ID, DEFAULT_BOARD_ID, start_date=start, end_date=end)
    titles = [task.title for column in view.columns for task in column.tasks]
    assert extra.title in titles


def test_date_field_created_at(client: TestClient, db: Session, today: date, uncategorized_id) -> None:
    created = task_service.create_task(
        db,
        BOOTSTRAP_USER_ID,
        TaskCreate(
            column_id=COLUMN_TODO_ID,
            category_id=uncategorized_id,
            title="Created today",
            due_date=today + timedelta(days=10),
        ),
    )
    response = client.get(
        f"/api/v1/boards/{DEFAULT_BOARD_ID}/view",
        params={
            "start_date": today.isoformat(),
            "end_date": today.isoformat(),
            "date_field": "created_at",
        },
    )
    assert response.status_code == 200, response.text
    titles = [task["title"] for column in response.json()["columns"] for task in column["tasks"]]
    assert created.title in titles
    due_only = client.get(
        f"/api/v1/boards/{DEFAULT_BOARD_ID}/view",
        params={
            "start_date": today.isoformat(),
            "end_date": today.isoformat(),
            "date_field": "due_date",
        },
    )
    due_titles = [task["title"] for column in due_only.json()["columns"] for task in column["tasks"]]
    assert created.title not in due_titles


def test_unbounded_view_returns_old_task(
    db: Session,
    today: date,
    uncategorized_id,
) -> None:
    old = Task(
        column_id=COLUMN_TODO_ID,
        category_id=uncategorized_id,
        title="Old due",
        start_date=today - timedelta(days=400),
        due_date=today - timedelta(days=400),
        priority="low",
        position=20,
        version=1,
    )
    db.add(old)
    db.commit()
    view = board_service.get_board_view(db, BOOTSTRAP_USER_ID, DEFAULT_BOARD_ID, unbounded=True)
    titles = [task.title for column in view.columns for task in column.tasks]
    assert "Old due" in titles
    assert view.unbounded is True


def test_column_crud_reorder_and_archive(client: TestClient) -> None:
    name = f"Review-{uuid4().hex[:8]}"
    created = client.post(
        f"/api/v1/boards/{DEFAULT_BOARD_ID}/columns",
        json={"name": name, "color": "violet", "is_done": False},
    )
    assert created.status_code == 201, created.text
    column_id = created.json()["id"]

    updated = client.patch(
        f"/api/v1/columns/{column_id}",
        json={"name": f"{name}-edited", "color": "pink", "is_done": False},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == f"{name}-edited"

    reordered = client.patch(
        f"/api/v1/columns/{column_id}/reorder",
        json={"target_position": 0},
    )
    assert reordered.status_code == 200
    assert reordered.json()["position"] == 0

    archived = client.post(
        f"/api/v1/columns/{column_id}/archive",
        json={},
    )
    assert archived.status_code == 200
    assert archived.json()["archived_at"] is not None

    view = client.get(
        f"/api/v1/boards/{DEFAULT_BOARD_ID}/view",
        params={"start_date": date.today().isoformat(), "end_date": date.today().isoformat()},
    )
    ids = [column["id"] for column in view.json()["columns"]]
    assert column_id not in ids


def test_archive_column_with_tasks_requires_move(
    client: TestClient,
    db: Session,
    today: date,
    uncategorized_id,
) -> None:
    created = client.post(
        f"/api/v1/boards/{DEFAULT_BOARD_ID}/columns",
        json={"name": f"Blocked-{uuid4().hex[:8]}", "color": "orange"},
    )
    column_id = created.json()["id"]
    task_service.create_task(
        db,
        BOOTSTRAP_USER_ID,
        TaskCreate(
            column_id=column_id,
            category_id=uncategorized_id,
            title="Stuck",
            due_date=today,
        ),
    )
    denied = client.post(f"/api/v1/columns/{column_id}/archive", json={})
    assert denied.status_code == 409

    moved = client.post(
        f"/api/v1/columns/{column_id}/archive",
        json={"move_to_column_id": str(COLUMN_DONE_ID)},
    )
    assert moved.status_code == 200, moved.text


def test_restore_archived_column_appends_empty(
    client: TestClient,
    db: Session,
    today: date,
    uncategorized_id,
) -> None:
    created = client.post(
        f"/api/v1/boards/{DEFAULT_BOARD_ID}/columns",
        json={"name": f"Parking-{uuid4().hex[:8]}", "color": "slate", "is_done": True},
    )
    assert created.status_code == 201, created.text
    column_id = created.json()["id"]
    original_name = created.json()["name"]
    task_service.create_task(
        db,
        BOOTSTRAP_USER_ID,
        TaskCreate(
            column_id=column_id,
            category_id=uncategorized_id,
            title="Move me",
            due_date=today,
        ),
    )
    archived = client.post(
        f"/api/v1/columns/{column_id}/archive",
        json={"move_to_column_id": str(COLUMN_DONE_ID)},
    )
    assert archived.status_code == 200
    assert archived.json()["archived_at"] is not None

    restored = client.post(f"/api/v1/columns/{column_id}/restore")
    assert restored.status_code == 200, restored.text
    body = restored.json()
    assert body["archived_at"] is None
    assert body["name"] == original_name
    assert body["is_done"] is True
    assert body["task_count"] == 0

    columns = client.get(f"/api/v1/boards/{DEFAULT_BOARD_ID}/columns").json()
    active = [item for item in columns if item["archived_at"] is None]
    assert active[-1]["id"] == column_id

    again = client.post(f"/api/v1/columns/{column_id}/restore")
    assert again.status_code == 200
    assert again.json()["archived_at"] is None


def test_restore_missing_column_is_404(client: TestClient) -> None:
    response = client.post(f"/api/v1/columns/{uuid4()}/restore")
    assert response.status_code == 404


def test_delete_column_requires_archived_empty_status(client: TestClient) -> None:
    name = f"Temp-{uuid4().hex[:8]}"
    created = client.post(
        f"/api/v1/boards/{DEFAULT_BOARD_ID}/columns",
        json={"name": name, "color": "slate", "is_done": False},
    )
    assert created.status_code == 201, created.text
    column_id = created.json()["id"]

    active_delete = client.delete(f"/api/v1/columns/{column_id}")
    assert active_delete.status_code == 422

    archived = client.post(f"/api/v1/columns/{column_id}/archive", json={})
    assert archived.status_code == 200
    deleted = client.delete(f"/api/v1/columns/{column_id}")
    assert deleted.status_code == 204
    listed = client.get(f"/api/v1/boards/{DEFAULT_BOARD_ID}/columns").json()
    assert column_id not in {item["id"] for item in listed}
    missing = client.delete(f"/api/v1/columns/{uuid4()}")
    assert missing.status_code == 404


def test_default_board_is_named_personal(client: TestClient) -> None:
    response = client.get(
        f"/api/v1/boards/{DEFAULT_BOARD_ID}/view",
        params={"unbounded": "true", "date_field": "due_date"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["name"] == "Personal"
