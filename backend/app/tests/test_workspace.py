from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.tests.auth_helpers import bind_client, register_user


def _folder(client: TestClient, name: str) -> dict:
    response = client.post("/api/v1/board-folders", json={"name": name})
    assert response.status_code == 201, response.text
    return response.json()


def _board(client: TestClient, boards: list[dict], board_id: str) -> dict:
    return next(item for item in boards if item["id"] == board_id)


def test_board_created_in_folder_and_moved_out(client: TestClient) -> None:
    folder = _folder(client, "Work")
    created = client.post("/api/v1/boards", json={"name": "Launch", "folder_id": folder["id"]})
    assert created.status_code == 201, created.text
    assert created.json()["folder_id"] == folder["id"]

    moved = client.patch(f"/api/v1/boards/{created.json()['id']}", json={"folder_id": None})
    assert moved.status_code == 200, moved.text
    assert moved.json()["folder_id"] is None


def test_folder_names_are_unique_and_rename_works(client: TestClient) -> None:
    folder = _folder(client, "Projects")
    duplicate = client.post("/api/v1/board-folders", json={"name": "projects"})
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "folder_name_taken"
    renamed = client.patch(f"/api/v1/board-folders/{folder['id']}", json={"name": "Side projects"})
    assert renamed.json()["name"] == "Side projects"


def test_deleting_folder_keeps_its_boards(client: TestClient) -> None:
    folder = _folder(client, "Temporary")
    board = client.post("/api/v1/boards", json={"name": "Keep me", "folder_id": folder["id"]}).json()
    assert client.delete(f"/api/v1/board-folders/{folder['id']}").status_code == 204
    boards = client.get("/api/v1/boards").json()
    assert _board(client, boards, board["id"])["folder_id"] is None


def test_folders_and_inbox_are_private(client: TestClient, db: Session) -> None:
    folder = _folder(client, "Private")
    item = client.post("/api/v1/inbox", json={"title": "Secret idea"}).json()
    other = bind_client(db)
    register_user(other, login_id="folder-outsider", display_name="Other")
    try:
        assert other.get("/api/v1/board-folders").json() == []
        assert other.get("/api/v1/inbox").json() == []
        assert other.delete(f"/api/v1/board-folders/{folder['id']}").status_code == 404
        assert other.patch(f"/api/v1/inbox/{item['id']}", json={"is_processed": True}).status_code == 404
        rejected = other.post("/api/v1/boards", json={"name": "Sneaky", "folder_id": folder["id"]})
        assert rejected.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_inbox_capture_process_and_delete(client: TestClient) -> None:
    created = client.post("/api/v1/inbox", json={"title": "  Call the bank  "})
    assert created.status_code == 201, created.text
    item = created.json()
    assert item["title"] == "Call the bank"
    done = client.patch(f"/api/v1/inbox/{item['id']}", json={"is_processed": True}).json()
    assert done["is_processed"] is True and done["processed_at"] is not None
    reopened = client.patch(f"/api/v1/inbox/{item['id']}", json={"is_processed": False}).json()
    assert reopened["processed_at"] is None
    assert client.delete(f"/api/v1/inbox/{item['id']}").status_code == 204
    assert client.get("/api/v1/inbox").json() == []
