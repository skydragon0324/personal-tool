from __future__ import annotations

from datetime import date
from io import BytesIO

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.tests.auth_helpers import bind_client, register_user

DAY = date(2026, 9, 23).isoformat()


def _board_ids(client: TestClient, board_id: str | None = None) -> tuple[str, list[dict], list[dict]]:
    if board_id is None:
        board_id = next(item["id"] for item in client.get("/api/v1/boards").json() if item["role"] == "owner")
    columns = client.get(f"/api/v1/boards/{board_id}/columns").json()
    categories = client.get(f"/api/v1/boards/{board_id}/categories").json()
    return board_id, columns, categories


def _new_board(client: TestClient, name: str) -> str:
    response = client.post("/api/v1/boards", json={"name": name})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _rich_task(client: TestClient, db: Session, **extra) -> dict:
    board_id, columns, categories = _board_ids(client)
    created = client.post(
        "/api/v1/tasks",
        json={
            "column_id": columns[0]["id"],
            "category_id": categories[0]["id"],
            "title": "Plan the launch",
            "start_date": DAY,
            "due_date": DAY,
            "priority": "high",
            "content": {
                "type": "doc",
                "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Checklist inside"}]}],
            },
            "links": [{"label": "Spec", "url": "https://example.com/spec", "position": 0}],
            **extra,
        },
    )
    assert created.status_code == 201, created.text
    task = created.json()
    for title in ("Draft", "Review"):
        client.post(f"/api/v1/tasks/{task['id']}/subtasks", json={"title": title})
    files = {"file": ("notes.txt", BytesIO(b"launch-notes"), "text/plain")}
    uploaded = client.post(f"/api/v1/tasks/{task['id']}/attachments", files=files)
    assert uploaded.status_code == 201, uploaded.text
    # Tests share one session across requests; drop cached rows so reads see the new children.
    db.expire_all()
    return client.get(f"/api/v1/tasks/{task['id']}").json()


def test_duplicate_copies_everything_but_the_assignee(client: TestClient, db: Session) -> None:
    me = client.get("/api/v1/auth/me").json()["id"]
    original = _rich_task(client, db, assignee_ids=[me])
    response = client.post(f"/api/v1/tasks/{original['id']}/duplicate")
    assert response.status_code == 201, response.text
    copy = response.json()

    assert copy["id"] != original["id"]
    assert copy["title"] == "Plan the launch (copy)"
    assert copy["column_id"] == original["column_id"]
    assert copy["category"]["id"] == original["category"]["id"]
    assert copy["priority"] == "high"
    assert copy["due_date"] == original["due_date"]
    assert copy["content"] == original["content"]
    assert [link["url"] for link in copy["links"]] == ["https://example.com/spec"]
    assert [item["title"] for item in copy["subtasks"]] == ["Draft", "Review"]
    assert copy["assignees"] == []
    assert copy["recurrence"] is None

    # Files are real copies: the duplicate's file downloads on its own.
    assert len(copy["attachments"]) == 1
    attachment = copy["attachments"][0]
    assert attachment["id"] != original["attachments"][0]["id"]
    download = client.get(f"/api/v1/tasks/{copy['id']}/attachments/{attachment['id']}/download")
    assert download.status_code == 200 and download.content == b"launch-notes"

    # The copy sits right below the original.
    board_id, _columns, _categories = _board_ids(client)
    view = client.get(f"/api/v1/boards/{board_id}/view", params={"date": DAY}).json()
    column = next(item for item in view["columns"] if item["id"] == original["column_id"])
    ids = [task["id"] for task in column["tasks"]]
    assert ids.index(copy["id"]) == ids.index(original["id"]) + 1


def test_duplicate_rewrites_inline_image_urls(client: TestClient) -> None:
    board_id, columns, categories = _board_ids(client)
    task = client.post(
        "/api/v1/tasks",
        json={"column_id": columns[0]["id"], "category_id": categories[0]["id"], "title": "Pic", "due_date": DAY},
    ).json()
    png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
        b"\x00\x00\x00\rIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    image = client.post(
        f"/api/v1/tasks/{task['id']}/attachments", files={"file": ("pic.png", BytesIO(png), "image/png")}
    ).json()
    content = {"type": "doc", "content": [{"type": "image", "attrs": {"src": image["download_url"]}}]}
    patched = client.patch(f"/api/v1/tasks/{task['id']}", json={"content": content})
    assert patched.status_code == 200, patched.text

    copy = client.post(f"/api/v1/tasks/{task['id']}/duplicate").json()
    src = copy["content"]["content"][0]["attrs"]["src"]
    assert src == copy["attachments"][0]["download_url"]
    assert task["id"] not in src


def test_move_to_board_brings_everything_along(client: TestClient, db: Session) -> None:
    original = _rich_task(client, db)
    target = _new_board(client, "Work")
    response = client.post(f"/api/v1/tasks/{original['id']}/move-to-board", json={"board_id": target})
    assert response.status_code == 200, response.text
    moved = response.json()

    _board, target_columns, target_categories = _board_ids(client, target)
    open_column = next(column for column in target_columns if not column["is_done"])
    assert moved["column_id"] == open_column["id"]
    # The category is matched by name on the new board.
    assert moved["category"]["id"] in {item["id"] for item in target_categories}
    assert moved["category"]["name"] == original["category"]["name"]
    assert [item["title"] for item in moved["subtasks"]] == ["Draft", "Review"]
    assert len(moved["attachments"]) == 1 and len(moved["links"]) == 1
    assert moved["content"] == original["content"]

    view = client.get(f"/api/v1/boards/{target}/view", params={"date": DAY}).json()
    assert any(task["id"] == original["id"] for column in view["columns"] for task in column["tasks"])


def test_move_to_done_status_on_other_board_completes_it(client: TestClient, db: Session) -> None:
    original = _rich_task(client, db)
    target = _new_board(client, "Errands")
    _board, columns, _categories = _board_ids(client, target)
    done = next(column for column in columns if column["is_done"])
    moved = client.post(
        f"/api/v1/tasks/{original['id']}/move-to-board", json={"board_id": target, "column_id": done["id"]}
    ).json()
    assert moved["column_id"] == done["id"]
    assert moved["completed_at"] is not None

    wrong = client.post(
        f"/api/v1/tasks/{original['id']}/move-to-board",
        json={"board_id": _board_ids(client)[0], "column_id": done["id"]},
    )
    assert wrong.status_code == 422


def test_move_keeps_assignee_only_if_on_target_board(client: TestClient, db: Session) -> None:
    mate = bind_client(db)
    mate_user = register_user(mate, email="mover-mate@example.com", display_name="Mate")["user"]
    try:
        home, _columns, _categories = _board_ids(client)
        client.post(f"/api/v1/boards/{home}/members", json={"email": "mover-mate@example.com"})
        shared_target = _new_board(client, "Shared target")
        client.post(f"/api/v1/boards/{shared_target}/members", json={"email": "mover-mate@example.com"})
        private_target = _new_board(client, "Private target")

        kept = _rich_task(client, db, assignee_ids=[mate_user["id"]])
        moved = client.post(
            f"/api/v1/tasks/{kept['id']}/move-to-board", json={"board_id": shared_target}
        ).json()
        assert [person["id"] for person in moved["assignees"]] == [mate_user["id"]]

        dropped = _rich_task(client, db, assignee_ids=[mate_user["id"]])
        moved = client.post(
            f"/api/v1/tasks/{dropped['id']}/move-to-board", json={"board_id": private_target}
        ).json()
        assert moved["assignees"] == []
    finally:
        app.dependency_overrides.clear()


def test_cannot_move_to_a_board_you_cannot_access(client: TestClient, db: Session) -> None:
    task = _rich_task(client, db)
    stranger = bind_client(db)
    register_user(stranger, email="stranger@example.com")
    try:
        foreign = stranger.post("/api/v1/boards", json={"name": "Not yours"}).json()["id"]
    finally:
        app.dependency_overrides.clear()
    # Rebind the owner's client after the stranger's requests.
    bind_client(db)
    response = client.post(f"/api/v1/tasks/{task['id']}/move-to-board", json={"board_id": foreign})
    assert response.status_code == 404
    app.dependency_overrides.clear()


def test_moving_a_repeating_occurrence_detaches_it(client: TestClient) -> None:
    board_id, columns, categories = _board_ids(client)
    created = client.post(
        "/api/v1/tasks",
        json={
            "column_id": columns[0]["id"],
            "category_id": categories[0]["id"],
            "title": "Weekly sync",
            "start_date": DAY,
            "due_date": DAY,
            "recurrence": {"freq": "weekly", "weekdays": [2]},
        },
    ).json()
    target = _new_board(client, "Meetings")
    moved = client.post(f"/api/v1/tasks/{created['id']}/move-to-board", json={"board_id": target}).json()
    assert moved["recurrence"] is None

    # The series does not recreate that date on the original board.
    view = client.get(f"/api/v1/boards/{board_id}/view", params={"date": DAY}).json()
    titles = [task["title"] for column in view["columns"] for task in column["tasks"]]
    assert "Weekly sync" not in titles
