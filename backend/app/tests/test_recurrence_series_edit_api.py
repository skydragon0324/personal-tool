from __future__ import annotations

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.tests.auth_helpers import bind_client, register_user

FRIDAY = date(2026, 8, 21)


def _board_ids(client: TestClient) -> tuple[str, str, str, str]:
    boards = client.get("/api/v1/boards").json()
    board_id = boards[0]["id"]
    columns = client.get(f"/api/v1/boards/{board_id}/columns").json()
    todo = next(item["id"] for item in columns if not item["is_done"])
    done = next(item["id"] for item in columns if item["is_done"])
    category = client.get(f"/api/v1/boards/{board_id}/categories").json()[0]["id"]
    return board_id, todo, done, category


def test_get_series_includes_edit_fields(client: TestClient) -> None:
    _board_id, todo, _done, category = _board_ids(client)
    created = client.post(
        "/api/v1/tasks",
        json={
            "column_id": todo,
            "category_id": category,
            "title": "Weekly report",
            "start_date": FRIDAY.isoformat(),
            "due_date": FRIDAY.isoformat(),
            "content": {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "body"}]}]},
            "links": [{"label": "Docs", "url": "https://example.com/docs", "position": 0}],
            "recurrence": {"freq": "weekly", "interval": 1, "weekdays": [4]},
        },
    )
    assert created.status_code == 201, created.text
    series_id = created.json()["recurrence"]["series_id"]
    series = client.get(f"/api/v1/task-recurrence/{series_id}")
    assert series.status_code == 200, series.text
    body = series.json()
    assert isinstance(body["version"], int)
    assert body["content"]["content"][0]["content"][0]["text"] == "body"
    assert body["content_schema_version"] == 1
    assert body["links"][0]["label"] == "Docs"
    assert body["links"][0]["url"] == "https://example.com/docs"
    assert "id" in body["links"][0]


def test_patch_series_updates_title_and_keeps_noop_version(client: TestClient) -> None:
    _board_id, todo, _done, category = _board_ids(client)
    created = client.post(
        "/api/v1/tasks",
        json={
            "column_id": todo,
            "category_id": category,
            "title": "Standup",
            "start_date": FRIDAY.isoformat(),
            "due_date": FRIDAY.isoformat(),
            "recurrence": {"freq": "weekly", "weekdays": [4]},
        },
    ).json()
    series_id = created["recurrence"]["series_id"]
    current = client.get(f"/api/v1/task-recurrence/{series_id}").json()
    patched = client.patch(
        f"/api/v1/task-recurrence/{series_id}",
        json={"expected_version": current["version"], "title": "  Morning standup  ", "priority": "high"},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["title"] == "Morning standup"
    assert patched.json()["priority"] == "high"
    assert patched.json()["version"] == current["version"] + 1
    listed = client.get("/api/v1/task-recurrence", params={"status": "active"}).json()
    item = next(row for row in listed["items"] if row["id"] == series_id)
    assert item["title"] == "Morning standup"
    noop = client.patch(
        f"/api/v1/task-recurrence/{series_id}",
        json={"expected_version": patched.json()["version"], "title": "Morning standup"},
    )
    assert noop.status_code == 200, noop.text
    assert noop.json()["version"] == patched.json()["version"]


def test_patch_series_validates_title_urls_and_version(client: TestClient) -> None:
    _board_id, todo, _done, category = _board_ids(client)
    created = client.post(
        "/api/v1/tasks",
        json={
            "column_id": todo,
            "category_id": category,
            "title": "Keep",
            "start_date": FRIDAY.isoformat(),
            "due_date": FRIDAY.isoformat(),
            "recurrence": {"freq": "weekly", "weekdays": [4]},
        },
    ).json()
    series_id = created["recurrence"]["series_id"]
    current = client.get(f"/api/v1/task-recurrence/{series_id}").json()
    blank = client.patch(
        f"/api/v1/task-recurrence/{series_id}",
        json={"expected_version": current["version"], "title": "   "},
    )
    assert blank.status_code == 422
    pause = client.patch(
        f"/api/v1/task-recurrence/{series_id}",
        json={"expected_version": current["version"], "recurrence": None},
    )
    assert pause.status_code == 422
    unsafe = client.patch(
        f"/api/v1/task-recurrence/{series_id}",
        json={
            "expected_version": current["version"],
            "links": [{"label": "Bad", "url": "javascript:alert(1)", "position": 0}],
        },
    )
    assert unsafe.status_code == 422
    stale = client.patch(
        f"/api/v1/task-recurrence/{series_id}",
        json={"expected_version": 999, "title": "Stale"},
    )
    assert stale.status_code == 409
    still = client.get(f"/api/v1/task-recurrence/{series_id}").json()
    assert still["title"] == "Keep"
    assert still["version"] == current["version"]


def test_patch_series_is_404_for_another_user(db: Session) -> None:
    owner = bind_client(db)
    register_user(owner, email="series-edit-owner@example.com")
    _board_id, todo, _done, category = _board_ids(owner)
    created = owner.post(
        "/api/v1/tasks",
        json={
            "column_id": todo,
            "category_id": category,
            "title": "Private",
            "start_date": FRIDAY.isoformat(),
            "due_date": FRIDAY.isoformat(),
            "recurrence": {"freq": "weekly", "weekdays": [4]},
        },
    )
    assert created.status_code == 201, created.text
    series_id = created.json()["recurrence"]["series_id"]
    outsider = bind_client(db)
    register_user(outsider, email="series-edit-other@example.com")
    assert outsider.get(f"/api/v1/task-recurrence/{series_id}").status_code == 404
    stolen = outsider.patch(
        f"/api/v1/task-recurrence/{series_id}",
        json={"expected_version": 1, "title": "Hijacked"},
    )
    assert stolen.status_code == 404
    app.dependency_overrides.clear()
