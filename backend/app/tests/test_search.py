from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.services import search_service
from app.tests.auth_helpers import bind_client, register_user

DAY = date(2031, 5, 6).isoformat()
# A word no seed data or other test uses, so every hit below comes from these tests.
WORD = "Zephyrine"


def _board(client: TestClient) -> tuple[str, str, str]:
    board_id = next(item["id"] for item in client.get("/api/v1/boards").json() if item["role"] == "owner")
    columns = client.get(f"/api/v1/boards/{board_id}/columns").json()
    todo = next(item["id"] for item in columns if not item["is_done"])
    category = client.get(f"/api/v1/boards/{board_id}/categories").json()[0]["id"]
    return board_id, todo, category


def _task(client: TestClient, column: str, category: str, title: str, **extra) -> dict:
    response = client.post(
        "/api/v1/tasks",
        json={"column_id": column, "category_id": category, "title": title, "start_date": DAY, "due_date": DAY, **extra},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _search(client: TestClient, q: str, **params) -> dict:
    response = client.get("/api/v1/search", params={"q": q, **params})
    assert response.status_code == 200, response.text
    return response.json()


def _labels(body: dict, kind: str) -> list[str]:
    group = next((group for group in body["groups"] if group["type"] == kind), None)
    return [item["label"] for item in group["items"]] if group else []


@pytest.fixture()
def mate(client: TestClient, db: Session):
    other = bind_client(db)
    register_user(other, login_id="mate", display_name="Mate")
    try:
        yield other
    finally:
        app.dependency_overrides.clear()


def test_finds_tasks_by_title_and_content_case_insensitively(client: TestClient) -> None:
    board_id, todo, category = _board(client)
    by_title = _task(client, todo, category, f"Book {WORD} flights")
    long_text = "lorem ipsum " * 200 + f"remember the {WORD.lower()} passport " + "dolor sit " * 200
    _task(
        client,
        todo,
        category,
        "Travel prep",
        content={"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": long_text}]}]},
    )

    body = _search(client, WORD.upper())
    group = next(group for group in body["groups"] if group["type"] == "task")
    assert [item["label"] for item in group["items"]] == [f"Book {WORD} flights", "Travel prep"]
    first, second = group["items"]
    assert first["id"] == by_title["id"]
    assert first["board_id"] == board_id
    assert first["board_name"]
    assert first["due_date"] == DAY
    assert first["is_done"] is False
    # A content match brings a short snippet around the match, never the whole document.
    assert WORD.lower() in second["secondary"].lower()
    assert len(second["secondary"]) <= search_service.SNIPPET_LENGTH
    assert "content" not in second


def test_finds_boards_notes_and_plans(client: TestClient) -> None:
    created = client.post("/api/v1/boards", json={"name": f"{WORD} board", "timezone": "UTC"})
    assert created.status_code == 201, created.text
    note = client.post("/api/v1/notes", json={"title": "Groceries", "body": f"milk, {WORD} tea, bread"})
    assert note.status_code == 201, note.text
    titled_note = client.post("/api/v1/notes", json={"title": f"{WORD} ideas", "body": "first line"})
    assert titled_note.status_code == 201
    plan = client.post("/api/v1/plans", json={"name": f"Learn {WORD}"})
    assert plan.status_code == 201, plan.text

    body = _search(client, WORD.lower())
    assert [group["type"] for group in body["groups"]] == ["board", "note", "plan"]
    board = body["groups"][0]["items"][0]
    assert board == {
        "type": "board",
        "id": created.json()["id"],
        "label": f"{WORD} board",
        "secondary": None,
        "board_id": created.json()["id"],
        "board_name": f"{WORD} board",
        "board_color": created.json()["color"],
        "due_date": None,
        "is_done": None,
    }
    # Title matches rank before body matches.
    assert _labels(body, "note") == [f"{WORD} ideas", "Groceries"]
    notes = body["groups"][1]["items"]
    assert notes[1]["id"] == note.json()["id"]
    assert WORD in notes[1]["secondary"]
    assert _labels(body, "plan") == [f"Learn {WORD}"]
    assert body["groups"][2]["items"][0]["id"] == plan.json()["id"]


def test_filters_by_type(client: TestClient) -> None:
    _, todo, category = _board(client)
    _task(client, todo, category, f"{WORD} task")
    client.post("/api/v1/notes", json={"title": f"{WORD} note"})
    body = _search(client, WORD, type="note")
    assert [group["type"] for group in body["groups"]] == ["note"]
    assert client.get("/api/v1/search", params={"q": WORD, "type": "user"}).status_code == 422


def test_empty_query_returns_nothing(client: TestClient) -> None:
    client.post("/api/v1/notes", json={"title": "Anything"})
    assert _search(client, "") == {"query": "", "groups": []}
    assert _search(client, "   ") == {"query": "", "groups": []}
    assert client.get("/api/v1/search").json() == {"query": "", "groups": []}


def test_limits_results_per_type_and_reports_more(client: TestClient) -> None:
    _, todo, category = _board(client)
    for index in range(4):
        _task(client, todo, category, f"{WORD} {index}")
    limited = _search(client, WORD, limit=3)
    group = limited["groups"][0]
    assert len(group["items"]) == 3
    assert group["has_more"] is True
    assert _search(client, WORD, limit=4)["groups"][0]["has_more"] is False
    assert client.get("/api/v1/search", params={"q": WORD, "limit": 0}).status_code == 422
    assert (
        client.get("/api/v1/search", params={"q": WORD, "limit": search_service.SEARCH_MAX_LIMIT + 1}).status_code
        == 422
    )


def test_wildcards_are_matched_literally(client: TestClient) -> None:
    _, todo, category = _board(client)
    _task(client, todo, category, f"{WORD} 50% off")
    _task(client, todo, category, f"{WORD} 50 items off")
    assert _labels(_search(client, "50%"), "task") == [f"{WORD} 50% off"]
    assert _labels(_search(client, "_"), "task") == []


def test_only_searches_what_the_user_can_access(client: TestClient, mate: TestClient) -> None:
    board_id, todo, category = _board(client)
    _task(client, todo, category, f"{WORD} owner task")
    client.post("/api/v1/notes", json={"title": f"{WORD} owner note"})
    client.post("/api/v1/plans", json={"name": f"{WORD} owner plan"})

    assert _search(mate, WORD)["groups"] == []

    shared = client.post(f"/api/v1/boards/{board_id}/members", json={"login_id": "mate"})
    assert shared.status_code == 201, shared.text
    body = _search(mate, WORD)
    # Tasks on a shared board are searchable; the owner's notes and plans stay private.
    assert _labels(body, "task") == [f"{WORD} owner task"]
    assert _labels(body, "note") == []
    assert _labels(body, "plan") == []


def test_leaves_out_archived_boards_and_their_tasks(client: TestClient) -> None:
    created = client.post("/api/v1/boards", json={"name": f"{WORD} archive", "timezone": "UTC"})
    board_id = created.json()["id"]
    columns = client.get(f"/api/v1/boards/{board_id}/columns").json()
    todo = next(item["id"] for item in columns if not item["is_done"])
    category = client.get(f"/api/v1/boards/{board_id}/categories").json()[0]["id"]
    _task(client, todo, category, f"{WORD} archived task")
    assert _labels(_search(client, WORD), "board") == [f"{WORD} archive"]

    assert client.post(f"/api/v1/boards/{board_id}/archive").status_code == 200
    assert _search(client, WORD)["groups"] == []


def test_requires_sign_in(anonymous_client: TestClient) -> None:
    assert anonymous_client.get("/api/v1/search", params={"q": WORD}).status_code == 401
