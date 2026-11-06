from __future__ import annotations

from datetime import date, timedelta
from io import BytesIO

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.tests.auth_helpers import bind_client, register_user

DAY = date.today()


def _board(client: TestClient) -> tuple[str, list[dict], str]:
    board_id = next(item["id"] for item in client.get("/api/v1/boards").json() if item["role"] == "owner")
    columns = client.get(f"/api/v1/boards/{board_id}/columns").json()
    category = client.get(f"/api/v1/boards/{board_id}/categories").json()[0]["id"]
    return board_id, columns, category


def _task(client: TestClient, **extra) -> dict:
    _, columns, category = _board(client)
    response = client.post(
        "/api/v1/tasks",
        json={
            "column_id": columns[0]["id"],
            "category_id": category,
            "title": "Write report",
            "start_date": DAY.isoformat(),
            "due_date": DAY.isoformat(),
            **extra,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _history(client: TestClient, task_id: str) -> list[dict]:
    response = client.get(f"/api/v1/tasks/{task_id}/history")
    assert response.status_code == 200, response.text
    return response.json()


def _changes(entry: dict) -> dict[str, dict]:
    return {change["field"]: change for change in entry["changes"]}


def test_creation_is_recorded_with_actor(client: TestClient) -> None:
    task = _task(client)
    history = _history(client, task["id"])
    assert len(history) == 1
    assert history[0]["action"] == "created"
    assert history[0]["actor_name"] == "Test Owner"
    assert history[0]["changes"] == []


def test_edit_records_old_and_new_values(client: TestClient) -> None:
    task = _task(client)
    due = (DAY + timedelta(days=3)).isoformat()
    response = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={
            "title": "Write the final report",
            "priority": "high",
            "due_date": due,
            "content": {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hi"}]}]},
            "links": [{"label": "Spec", "url": "https://example.com/spec", "position": 0}],
        },
    )
    assert response.status_code == 200, response.text

    latest = _history(client, task["id"])[0]
    assert latest["action"] == "updated"
    changes = _changes(latest)
    assert changes["title"] == {"field": "title", "from": "Write report", "to": "Write the final report"}
    assert changes["priority"] == {"field": "priority", "from": "medium", "to": "high"}
    assert changes["due_date"]["to"] == due
    assert changes["details"] == {"field": "details"}
    assert changes["links"] == {"field": "links", "added": ["Spec"], "removed": []}


def test_saving_without_changes_adds_no_entry(client: TestClient) -> None:
    task = _task(client)
    client.patch(f"/api/v1/tasks/{task['id']}", json={"title": "Write report"})
    assert len(_history(client, task["id"])) == 1


def test_status_move_records_status_names(client: TestClient) -> None:
    task = _task(client)
    _, columns, _ = _board(client)
    done = next(item for item in columns if item["is_done"])
    response = client.patch(
        f"/api/v1/tasks/{task['id']}/move",
        json={"target_column_id": done["id"], "expected_version": task["version"]},
    )
    assert response.status_code == 200, response.text
    changes = _changes(_history(client, task["id"])[0])
    assert changes["status"] == {"field": "status", "from": columns[0]["name"], "to": done["name"]}


def test_files_and_subtasks_are_listed_on_the_parent(client: TestClient) -> None:
    task = _task(client)
    upload = client.post(
        f"/api/v1/tasks/{task['id']}/attachments",
        files={"file": ("notes.txt", BytesIO(b"hello"), "text/plain")},
    )
    assert upload.status_code == 201, upload.text
    assert _changes(_history(client, task["id"])[0])["files"] == {
        "field": "files",
        "added": ["notes.txt"],
        "removed": [],
    }

    subtask = client.post(f"/api/v1/tasks/{task['id']}/subtasks", json={"title": "Outline"})
    assert subtask.status_code == 201, subtask.text
    assert _changes(_history(client, task["id"])[0])["subtasks"]["added"] == ["Outline"]
    # The sub-task has its own history.
    assert _history(client, subtask.json()["id"])[0]["action"] == "created"

    deleted = client.delete(f"/api/v1/tasks/{task['id']}/attachments/{upload.json()['id']}")
    assert deleted.status_code == 204
    assert _changes(_history(client, task["id"])[0])["files"]["removed"] == ["notes.txt"]


def test_failed_change_records_nothing(client: TestClient) -> None:
    task = _task(client)
    bad = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"start_date": (DAY + timedelta(days=5)).isoformat()},
    )
    assert bad.status_code == 422
    assert len(_history(client, task["id"])) == 1


def test_history_shows_who_made_each_change(client: TestClient, db: Session) -> None:
    mate = bind_client(db)
    mate_user = register_user(mate, email="mate@example.com", display_name="Mate")["user"]
    try:
        board_id, _, _ = _board(client)
        shared = client.post(f"/api/v1/boards/{board_id}/members", json={"email": "mate@example.com"})
        assert shared.status_code == 201, shared.text
        task = _task(client)
        edited = mate.patch(
            f"/api/v1/tasks/{task['id']}",
            json={"title": "Renamed by mate", "assignee_ids": [mate_user["id"]]},
        )
        assert edited.status_code == 200, edited.text

        history = _history(client, task["id"])
        assert [entry["actor_name"] for entry in history] == ["Mate", "Test Owner"]
        assert _changes(history[0])["assignees"] == {"field": "assignees", "added": ["Mate"], "removed": []}
    finally:
        app.dependency_overrides.clear()


def test_outsiders_cannot_read_history(client: TestClient, db: Session) -> None:
    task = _task(client)
    outsider = bind_client(db)
    register_user(outsider, email="outsider@example.com", display_name="Outsider")
    try:
        assert outsider.get(f"/api/v1/tasks/{task['id']}/history").status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_history_failure_never_blocks_the_change(client: TestClient, monkeypatch) -> None:
    from app.services import task_history_service

    def broken(*_args, **_kwargs):
        raise RuntimeError("history table missing")

    monkeypatch.setattr(task_history_service, "_add_entry", broken)
    task = _task(client)
    edited = client.patch(f"/api/v1/tasks/{task['id']}", json={"title": "Still saved"})
    assert edited.status_code == 200, edited.text
    assert client.get(f"/api/v1/tasks/{task['id']}").json()["title"] == "Still saved"
