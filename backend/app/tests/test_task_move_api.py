from datetime import date
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.constants import DEFAULT_BOARD_ID
from app.main import app
from app.tests.auth_helpers import bind_client, register_user


def _columns(client: TestClient) -> dict[str, dict]:
    items = client.get(f"/api/v1/boards/{DEFAULT_BOARD_ID}/columns").json()
    return {item["name"]: item for item in items if item["archived_at"] is None}


def _category_id(client: TestClient) -> str:
    return client.get(f"/api/v1/boards/{DEFAULT_BOARD_ID}/categories").json()[0]["id"]


def _create_task(client: TestClient, title: str, column_id: str, *, due: date | None = None) -> dict:
    due = due or date(2026, 8, 20)
    response = client.post(
        "/api/v1/tasks",
        json={
            "column_id": column_id,
            "category_id": _category_id(client),
            "title": title,
            "start_date": due.isoformat(),
            "due_date": due.isoformat(),
            "priority": "medium",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _move(client: TestClient, task: dict, **payload) -> tuple[int, dict | str]:
    body = {"expected_version": task["version"], **payload}
    response = client.patch(f"/api/v1/tasks/{task['id']}/move", json=body)
    try:
        parsed = response.json()
    except Exception:
        parsed = response.text
    return response.status_code, parsed


def _view_titles(client: TestClient, column_name: str) -> list[str]:
    view = client.get(
        f"/api/v1/boards/{DEFAULT_BOARD_ID}/view",
        params={"unbounded": True},
    )
    assert view.status_code == 200, view.text
    column = next(item for item in view.json()["columns"] if item["name"] == column_name)
    return [task["title"] for task in column["tasks"]]


def test_move_reorders_inside_the_same_status(client: TestClient) -> None:
    columns = _columns(client)
    todo = columns["To Do"]["id"]
    alpha = _create_task(client, "Move Alpha", todo)
    bravo = _create_task(client, "Move Bravo", todo)
    charlie = _create_task(client, "Move Charlie", todo)
    status, body = _move(
        client,
        alpha,
        target_column_id=todo,
        after_task_id=charlie["id"],
    )
    assert status == 200, body
    assert body["column_id"] == todo
    assert body["version"] == alpha["version"] + 1
    assert _view_titles(client, "To Do")[-3:] == ["Move Bravo", "Move Charlie", "Move Alpha"]


def test_move_to_another_status_and_empty_status(client: TestClient) -> None:
    columns = _columns(client)
    todo = columns["To Do"]["id"]
    doing = columns["In Progress"]["id"]
    done = columns["Done"]["id"]
    first = _create_task(client, "Cross First", todo)
    second = _create_task(client, "Cross Second", todo)

    status, body = _move(client, first, target_column_id=doing)
    assert status == 200, body
    assert body["column_id"] == doing
    assert body["completed_at"] is None
    assert "Cross First" in _view_titles(client, "In Progress")
    assert "Cross First" not in _view_titles(client, "To Do")

    status, body = _move(client, second, target_column_id=done)
    assert status == 200, body
    assert body["column_id"] == done
    assert body["completed_at"] is not None
    assert "Cross Second" in _view_titles(client, "Done")


def test_leaving_done_clears_completed_at(client: TestClient) -> None:
    columns = _columns(client)
    todo = columns["To Do"]["id"]
    done = columns["Done"]["id"]
    task = _create_task(client, "Leave Done", todo)
    status, body = _move(client, task, target_column_id=done)
    assert status == 200, body
    assert body["completed_at"] is not None
    status, restored = _move(client, body, target_column_id=todo)
    assert status == 200, restored
    assert restored["column_id"] == todo
    assert restored["completed_at"] is None
    assert "Leave Done" in _view_titles(client, "To Do")


def test_stale_version_returns_409(client: TestClient) -> None:
    columns = _columns(client)
    todo = columns["To Do"]["id"]
    doing = columns["In Progress"]["id"]
    task = _create_task(client, "Stale Move", todo)
    status, body = _move(
        client,
        task,
        target_column_id=doing,
        expected_version=999,
    )
    assert status == 409, body


def test_invalid_csrf_returns_403(client: TestClient) -> None:
    columns = _columns(client)
    todo = columns["To Do"]["id"]
    doing = columns["In Progress"]["id"]
    task = _create_task(client, "CSRF Move", todo)
    client.auto_csrf = False  # type: ignore[attr-defined]
    origin = get_settings().cors_origin_list[0]
    response = client.patch(
        f"/api/v1/tasks/{task['id']}/move",
        json={"target_column_id": doing, "expected_version": task["version"]},
        headers={"Origin": origin, "X-CSRF-Token": "invalid-token"},
    )
    assert response.status_code == 403
    assert "CSRF" in response.json()["detail"]


def test_another_user_cannot_move_task(db: Session) -> None:
    first = bind_client(db)
    register_user(first, email=f"move-a-{uuid4().hex[:8]}@example.com")
    columns = _columns(first)
    todo = columns["To Do"]["id"]
    doing = columns["In Progress"]["id"]
    task = _create_task(first, "Private Move", todo)

    second = bind_client(db)
    register_user(second, email=f"move-b-{uuid4().hex[:8]}@example.com")
    stolen = second.patch(
        f"/api/v1/tasks/{task['id']}/move",
        json={"target_column_id": doing, "expected_version": task["version"]},
    )
    assert stolen.status_code == 404
    app.dependency_overrides.clear()
