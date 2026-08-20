from __future__ import annotations

from datetime import date
from io import BytesIO
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.constants import BOOTSTRAP_USER_ID, COLUMN_TODO_ID, DEFAULT_BOARD_ID
from app.models import Task
from app.schemas.task import TaskCreate, TaskMove
from app.services import task_ordering_service, task_service


def test_default_board_is_named_personal(client: TestClient) -> None:
    response = client.get(f"/api/v1/boards/{DEFAULT_BOARD_ID}")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["name"] == "Personal"
    assert body["archived_at"] is None


def test_list_boards_includes_counts(client: TestClient, seed_tasks: list[Task]) -> None:
    response = client.get("/api/v1/boards")
    assert response.status_code == 200, response.text
    personal = next(item for item in response.json() if item["id"] == str(DEFAULT_BOARD_ID))
    assert personal["name"] == "Personal"
    assert personal["total_tasks"] == 3
    assert "completed_tasks" in personal
    assert "color" in personal
    assert "icon_name" in personal
    assert "position" in personal


def test_create_board_seeds_isolated_defaults(client: TestClient) -> None:
    created = client.post(
        "/api/v1/boards",
        json={"name": "  Work  ", "color": "blue", "icon_name": "briefcase", "timezone": "UTC"},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["name"] == "Work"
    board_id = body["id"]
    assert board_id != str(DEFAULT_BOARD_ID)

    columns = client.get(f"/api/v1/boards/{board_id}/columns").json()
    active = [item for item in columns if item["archived_at"] is None]
    names = [item["name"] for item in active]
    assert names == ["To Do", "In Progress", "Done"]
    done = next(item for item in active if item["name"] == "Done")
    assert done["is_done"] is True
    assert {item["id"] for item in active}.isdisjoint(
        {str(COLUMN_TODO_ID)}
    )

    categories = client.get(f"/api/v1/boards/{board_id}/categories").json()
    assert [item["name"] for item in categories] == ["Uncategorized"]
    assert categories[0]["board_id"] == board_id

    default_categories = client.get(f"/api/v1/boards/{DEFAULT_BOARD_ID}/categories").json()
    assert categories[0]["id"] not in {item["id"] for item in default_categories}


def test_create_board_rejects_blank_and_duplicate_names(client: TestClient) -> None:
    blank = client.post("/api/v1/boards", json={"name": "   "})
    assert blank.status_code == 422

    first = client.post("/api/v1/boards", json={"name": "Friends", "timezone": "UTC"})
    assert first.status_code == 201, first.text
    duplicate = client.post("/api/v1/boards", json={"name": "friends", "timezone": "UTC"})
    assert duplicate.status_code == 409


def test_cannot_archive_last_active_board(client: TestClient) -> None:
    extra = client.post("/api/v1/boards", json={"name": f"Temp-{uuid4().hex[:8]}", "timezone": "UTC"})
    assert extra.status_code == 201, extra.text
    extra_id = extra.json()["id"]

    archived = client.post(f"/api/v1/boards/{extra_id}/archive")
    assert archived.status_code == 200
    assert archived.json()["archived_at"] is not None

    listed = client.get("/api/v1/boards").json()
    active = [item for item in listed if item["archived_at"] is None]
    last_id = active[0]["id"]
    denied = client.post(f"/api/v1/boards/{last_id}/archive")
    assert denied.status_code == 422

    restored = client.post(f"/api/v1/boards/{extra_id}/restore")
    assert restored.status_code == 200
    assert restored.json()["archived_at"] is None
    active_after = [item for item in client.get("/api/v1/boards").json() if item["archived_at"] is None]
    assert active_after[-1]["id"] == extra_id


def test_archive_preserves_tasks_and_restore_returns_them(
    client: TestClient,
    db: Session,
    today: date,
) -> None:
    created = client.post("/api/v1/boards", json={"name": f"Keep-{uuid4().hex[:8]}", "timezone": "UTC"})
    assert created.status_code == 201, created.text
    board_id = created.json()["id"]
    columns = client.get(f"/api/v1/boards/{board_id}/columns").json()
    todo = next(item for item in columns if item["name"] == "To Do")
    uncategorized = client.get(f"/api/v1/boards/{board_id}/categories").json()[0]

    task = task_service.create_task(
        db,
        BOOTSTRAP_USER_ID,
        TaskCreate(
            column_id=todo["id"],
            category_id=uncategorized["id"],
            title="Stay put",
            due_date=today,
        ),
    )

    archived = client.post(f"/api/v1/boards/{board_id}/archive")
    assert archived.status_code == 200
    still = db.get(Task, task.id)
    assert still is not None
    assert str(still.column_id) == todo["id"]

    restored = client.post(f"/api/v1/boards/{board_id}/restore")
    assert restored.status_code == 200
    view = client.get(
        f"/api/v1/boards/{board_id}/view",
        params={"unbounded": "true", "date_field": "due_date"},
    )
    assert view.status_code == 200, view.text
    titles = [item["title"] for column in view.json()["columns"] for item in column["tasks"]]
    assert "Stay put" in titles


def test_move_rejects_status_from_another_board(
    client: TestClient,
    db: Session,
    seed_tasks: list[Task],
) -> None:
    created = client.post("/api/v1/boards", json={"name": f"Other-{uuid4().hex[:8]}", "timezone": "UTC"})
    assert created.status_code == 201, created.text
    other_id = created.json()["id"]
    other_done = next(
        item
        for item in client.get(f"/api/v1/boards/{other_id}/columns").json()
        if item["name"] == "Done"
    )

    moving = seed_tasks[0]
    with pytest.raises(HTTPException) as exc:
        task_ordering_service.move_task(
            db,
            BOOTSTRAP_USER_ID,
            moving.id,
            TaskMove(
                target_column_id=other_done["id"],
                expected_version=moving.version,
            ),
        )
    assert exc.value.status_code == 422

    http = client.patch(
        f"/api/v1/tasks/{moving.id}/move",
        json={
            "target_column_id": other_done["id"],
            "expected_version": moving.version,
        },
    )
    assert http.status_code == 422


def test_new_board_done_status_counts_as_completed(
    client: TestClient,
    db: Session,
    today: date,
) -> None:
    created = client.post("/api/v1/boards", json={"name": f"Progress-{uuid4().hex[:8]}", "timezone": "UTC"})
    board_id = created.json()["id"]
    columns = {item["name"]: item for item in client.get(f"/api/v1/boards/{board_id}/columns").json()}
    uncategorized = client.get(f"/api/v1/boards/{board_id}/categories").json()[0]
    task_service.create_task(
        db,
        BOOTSTRAP_USER_ID,
        TaskCreate(
            column_id=columns["Done"]["id"],
            category_id=uncategorized["id"],
            title="Finished",
            due_date=today,
        ),
    )
    view = client.get(
        f"/api/v1/boards/{board_id}/view",
        params={"unbounded": "true", "date_field": "due_date"},
    )
    assert view.status_code == 200
    summary = view.json()["summary"]
    assert summary["total"] == 1
    assert summary["completed"] == 1


def test_create_board_with_custom_statuses(client: TestClient) -> None:
    created = client.post(
        "/api/v1/boards",
        json={
            "name": f"Custom-{uuid4().hex[:8]}",
            "timezone": "UTC",
            "statuses": [
                {"name": "Backlog", "color": "slate", "is_done": False, "position": 0},
                {"name": "Shipped", "color": "teal", "is_done": True, "position": 1},
            ],
        },
    )
    assert created.status_code == 201, created.text
    board_id = created.json()["id"]
    columns = client.get(f"/api/v1/boards/{board_id}/columns").json()
    active = [item for item in columns if item["archived_at"] is None]
    assert [(item["name"], item["is_done"]) for item in active] == [
        ("Backlog", False),
        ("Shipped", True),
    ]
    categories = client.get(f"/api/v1/boards/{board_id}/categories").json()
    assert [item["name"] for item in categories] == ["Uncategorized"]


def test_create_board_rejects_invalid_statuses(client: TestClient) -> None:
    missing_done = client.post(
        "/api/v1/boards",
        json={
            "name": f"NoDone-{uuid4().hex[:8]}",
            "timezone": "UTC",
            "statuses": [{"name": "Only", "color": "slate", "is_done": False, "position": 0}],
        },
    )
    assert missing_done.status_code == 422

    duplicate = client.post(
        "/api/v1/boards",
        json={
            "name": f"Dup-{uuid4().hex[:8]}",
            "timezone": "UTC",
            "statuses": [
                {"name": "Todo", "color": "slate", "is_done": False, "position": 0},
                {"name": "todo", "color": "blue", "is_done": True, "position": 1},
            ],
        },
    )
    assert duplicate.status_code == 422


def test_delete_board_requires_archive_and_removes_records(
    client: TestClient,
) -> None:
    created = client.post("/api/v1/boards", json={"name": f"Gone-{uuid4().hex[:8]}", "timezone": "UTC"})
    assert created.status_code == 201, created.text
    board_id = created.json()["id"]
    denied = client.delete(f"/api/v1/boards/{board_id}")
    assert denied.status_code == 422

    archived = client.post(f"/api/v1/boards/{board_id}/archive")
    assert archived.status_code == 200
    deleted = client.delete(f"/api/v1/boards/{board_id}")
    assert deleted.status_code == 204
    missing = client.get(f"/api/v1/boards/{board_id}")
    assert missing.status_code == 404
    unknown = client.delete(f"/api/v1/boards/{uuid4()}")
    assert unknown.status_code == 404


def test_delete_board_removes_upload_files(
    client: TestClient,
    db: Session,
    today: date,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
    get_settings.cache_clear()
    created = client.post("/api/v1/boards", json={"name": f"Files-{uuid4().hex[:8]}", "timezone": "UTC"})
    board_id = created.json()["id"]
    columns = client.get(f"/api/v1/boards/{board_id}/columns").json()
    todo = next(item for item in columns if item["name"] == "To Do")
    uncategorized = client.get(f"/api/v1/boards/{board_id}/categories").json()[0]
    task = task_service.create_task(
        db,
        BOOTSTRAP_USER_ID,
        TaskCreate(
            column_id=todo["id"],
            category_id=uncategorized["id"],
            title="With file",
            due_date=today,
        ),
    )
    files = {"file": ("note.txt", BytesIO(b"keep me"), "text/plain")}
    uploaded = client.post(f"/api/v1/tasks/{task.id}/attachments", files=files)
    assert uploaded.status_code == 201, uploaded.text
    assert list(tmp_path.iterdir())

    archived = client.post(f"/api/v1/boards/{board_id}/archive")
    assert archived.status_code == 200
    deleted = client.delete(f"/api/v1/boards/{board_id}")
    assert deleted.status_code == 204
    assert list(tmp_path.iterdir()) == []
    get_settings.cache_clear()
