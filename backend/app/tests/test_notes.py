from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.constants import BOOTSTRAP_USER_ID, DEFAULT_BOARD_ID
from app.models.note import Note
from app.models.task import Task


def test_create_note_trims_title_and_allows_empty_body(client: TestClient) -> None:
    response = client.post("/api/v1/notes", json={"title": "  Shopping list  "})
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["title"] == "Shopping list"
    assert body["body"] == ""
    assert body["priority"] is None
    assert body["is_pinned"] is False
    assert "id" in body
    assert "created_at" in body
    assert "updated_at" in body


def test_create_note_rejects_blank_title(client: TestClient) -> None:
    blank = client.post("/api/v1/notes", json={"title": "   ", "body": "ideas"})
    assert blank.status_code == 422
    missing = client.post("/api/v1/notes", json={"body": "ideas"})
    assert missing.status_code == 422


def test_create_note_accepts_priority_and_plain_text_body(client: TestClient) -> None:
    response = client.post(
        "/api/v1/notes",
        json={"title": "Trip", "body": "Pack charger\nBring passport", "priority": "high", "is_pinned": True},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["body"] == "Pack charger\nBring passport"
    assert body["priority"] == "high"
    assert body["is_pinned"] is True


def test_list_notes_sorts_pinned_then_updated_then_created(client: TestClient, db: Session) -> None:
    db.execute(text("DELETE FROM notes"))
    db.commit()
    older = datetime.now(timezone.utc) - timedelta(days=2)
    middle = datetime.now(timezone.utc) - timedelta(days=1)
    newer = datetime.now(timezone.utc) - timedelta(hours=1)

    first = Note(user_id=BOOTSTRAP_USER_ID, title="Unpinned older", body="", is_pinned=False, created_at=older, updated_at=older)
    second = Note(user_id=BOOTSTRAP_USER_ID, title="Unpinned newer", body="", is_pinned=False, created_at=middle, updated_at=newer)
    pinned = Note(user_id=BOOTSTRAP_USER_ID, title="Pinned stale", body="", is_pinned=True, created_at=older, updated_at=older)
    db.add_all([first, second, pinned])
    db.commit()

    response = client.get("/api/v1/notes")
    assert response.status_code == 200, response.text
    titles = [item["title"] for item in response.json()]
    assert titles[:3] == ["Pinned stale", "Unpinned newer", "Unpinned older"]


def test_list_notes_filters_query_priority_and_pinned(client: TestClient, db: Session) -> None:
    db.execute(text("DELETE FROM notes"))
    db.commit()
    client.post("/api/v1/notes", json={"title": "Garden plan", "body": "Buy soil", "priority": "low"})
    client.post(
        "/api/v1/notes",
        json={"title": "Work memo", "body": "Follow up tomorrow", "priority": "high", "is_pinned": True},
    )
    client.post("/api/v1/notes", json={"title": "Recipe", "body": "Garden herbs", "priority": "high"})

    search = client.get("/api/v1/notes", params={"query": "garden"})
    assert {item["title"] for item in search.json()} == {"Garden plan", "Recipe"}

    high = client.get("/api/v1/notes", params={"priority": "high"})
    assert {item["title"] for item in high.json()} == {"Work memo", "Recipe"}

    pinned = client.get("/api/v1/notes", params={"pinned": True})
    assert [item["title"] for item in pinned.json()] == ["Work memo"]


def test_get_update_and_delete_note(client: TestClient) -> None:
    created = client.post("/api/v1/notes", json={"title": "Draft", "body": "v1", "priority": "medium"}).json()
    note_id = created["id"]

    fetched = client.get(f"/api/v1/notes/{note_id}")
    assert fetched.status_code == 200
    assert fetched.json()["title"] == "Draft"

    patched = client.patch(
        f"/api/v1/notes/{note_id}",
        json={"title": "  Final  ", "body": "v2", "priority": None, "is_pinned": True},
    )
    assert patched.status_code == 200, patched.text
    body = patched.json()
    assert body["title"] == "Final"
    assert body["body"] == "v2"
    assert body["priority"] is None
    assert body["is_pinned"] is True

    missing_title = client.patch(f"/api/v1/notes/{note_id}", json={"title": "   "})
    assert missing_title.status_code == 422

    deleted = client.delete(f"/api/v1/notes/{note_id}")
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/notes/{note_id}").status_code == 404


def test_note_not_found(client: TestClient) -> None:
    missing_id = uuid4()
    assert client.get(f"/api/v1/notes/{missing_id}").status_code == 404
    assert client.patch(f"/api/v1/notes/{missing_id}", json={"title": "Nope"}).status_code == 404
    assert client.delete(f"/api/v1/notes/{missing_id}").status_code == 404


def test_notes_are_isolated_from_boards_and_tasks(
    client: TestClient,
    seed_tasks: list[Task],
) -> None:
    created = client.post("/api/v1/notes", json={"title": "Shopping list", "body": "Milk"})
    assert created.status_code == 201, created.text

    view = client.get(f"/api/v1/boards/{DEFAULT_BOARD_ID}/view", params={"unbounded": True})
    assert view.status_code == 200, view.text
    task_titles = [task["title"] for column in view.json()["columns"] for task in column["tasks"]]
    assert "Shopping list" not in task_titles
    assert {task.title for task in seed_tasks} <= set(task_titles)

    notes = client.get("/api/v1/notes").json()
    assert any(item["title"] == "Shopping list" for item in notes)
    assert all("board_id" not in item for item in notes)
    assert all("due_date" not in item for item in notes)
    assert all("column_id" not in item for item in notes)


def test_pin_toggle_preserves_fields_and_sorts_pinned_first(client: TestClient) -> None:
    first = client.post(
        "/api/v1/notes",
        json={"title": "Keep body", "body": "original text", "priority": "high"},
    ).json()
    client.post("/api/v1/notes", json={"title": "Later note", "body": "newer"})

    pinned = client.patch(f"/api/v1/notes/{first['id']}", json={"is_pinned": True})
    assert pinned.status_code == 200, pinned.text
    body = pinned.json()
    assert body["is_pinned"] is True
    assert body["title"] == "Keep body"
    assert body["body"] == "original text"
    assert body["priority"] == "high"

    listed = client.get("/api/v1/notes").json()
    assert listed[0]["id"] == first["id"]
    assert listed[0]["is_pinned"] is True

    unpinned = client.patch(f"/api/v1/notes/{first['id']}", json={"is_pinned": False})
    assert unpinned.status_code == 200, unpinned.text
    assert unpinned.json()["is_pinned"] is False
    assert unpinned.json()["title"] == "Keep body"
    assert unpinned.json()["body"] == "original text"


def test_pin_missing_note_returns_404(client: TestClient) -> None:
    missing_id = uuid4()
    response = client.patch(f"/api/v1/notes/{missing_id}", json={"is_pinned": True})
    assert response.status_code == 404
    assert response.json()["detail"] == "Note not found"

