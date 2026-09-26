from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.tests.auth_helpers import bind_client, register_user

DAY = date.today().isoformat()


@pytest.fixture()
def team(client: TestClient, db: Session):
    """The default owner plus a registered teammate, each with their own client."""
    mate = bind_client(db)
    mate_user = register_user(mate, email="mate@example.com", display_name="Mate")["user"]
    try:
        yield client, mate, mate_user
    finally:
        app.dependency_overrides.clear()


def _board(client: TestClient) -> tuple[str, str, str, str]:
    board_id = next(item["id"] for item in client.get("/api/v1/boards").json() if item["role"] == "owner")
    columns = client.get(f"/api/v1/boards/{board_id}/columns").json()
    todo = next(item["id"] for item in columns if not item["is_done"])
    done = next(item["id"] for item in columns if item["is_done"])
    category = client.get(f"/api/v1/boards/{board_id}/categories").json()[0]["id"]
    return board_id, todo, done, category


def _task(client: TestClient, column: str, category: str, title: str, **extra) -> dict:
    response = client.post(
        "/api/v1/tasks",
        json={
            "column_id": column,
            "category_id": category,
            "title": title,
            "start_date": DAY,
            "due_date": DAY,
            **extra,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _share(owner: TestClient, board_id: str, email: str = "mate@example.com") -> dict:
    response = owner.post(f"/api/v1/boards/{board_id}/members", json={"email": email})
    assert response.status_code == 201, response.text
    return response.json()


def _notifications(client: TestClient, kind: str) -> list[dict]:
    return [item for item in client.get("/api/v1/notifications").json()["items"] if item["kind"] == kind]


def test_owner_shares_board_and_member_sees_it(team) -> None:
    owner, mate, mate_user = team
    board_id, *_ = _board(owner)
    result = _share(owner, board_id)
    assert result["status"] == "added"
    people = result["members"]["people"]
    assert [(person["display_name"], person["role"]) for person in people] == [
        ("Test Owner", "owner"),
        ("Mate", "member"),
    ]

    boards = mate.get("/api/v1/boards").json()
    shared = next(item for item in boards if item["id"] == board_id)
    assert shared["role"] == "member"
    assert shared["owner_name"] == "Test Owner"
    assert shared["member_count"] == 1
    # The teammate's own board is listed before boards shared with them.
    assert boards[0]["role"] == "owner"

    view = mate.get(f"/api/v1/boards/{board_id}/view", params={"date": DAY})
    assert view.status_code == 200
    assert view.json()["role"] == "member"
    members = mate.get(f"/api/v1/boards/{board_id}/members").json()
    assert members["can_manage"] is False
    assert members["invitations"] == []

    shared_notice = _notifications(mate, "board_shared")
    assert shared_notice and shared_notice[0]["board_id"] == board_id

    again = owner.post(f"/api/v1/boards/{board_id}/members", json={"email": "MATE@example.com"})
    assert again.status_code == 409


def test_member_creates_edits_moves_and_assigns_tasks(team) -> None:
    owner, mate, mate_user = team
    board_id, todo, done, category = _board(owner)
    _share(owner, board_id)
    owner_id = owner.get("/api/v1/auth/me").json()["id"]

    task = _task(mate, todo, category, "Write the report", assignee_ids=[owner_id])
    assert [person["display_name"] for person in task["assignees"]] == ["Test Owner"]
    assigned = _notifications(owner, "task_assigned")
    assert assigned and assigned[0]["task_id"] == task["id"]
    assert "Mate assigned" in assigned[0]["body"]

    edited = mate.patch(f"/api/v1/tasks/{task['id']}", json={"title": "Write the final report"})
    assert edited.status_code == 200, edited.text
    reassigned = owner.patch(
        f"/api/v1/tasks/{task['id']}", json={"assignee_ids": [owner_id, mate_user["id"]]}
    )
    assert [person["display_name"] for person in reassigned.json()["assignees"]] == ["Mate", "Test Owner"]
    assert _notifications(mate, "task_assigned")[0]["title"] == "Write the final report"

    moved = mate.patch(
        f"/api/v1/tasks/{task['id']}/move",
        json={"target_column_id": done, "expected_version": reassigned.json()["version"]},
    )
    assert moved.status_code == 200, moved.text

    category_created = mate.post(
        f"/api/v1/boards/{board_id}/categories", json={"name": "Team", "color": "blue"}
    )
    assert category_created.status_code == 201, category_created.text

    unassigned = mate.patch(f"/api/v1/tasks/{task['id']}", json={"assignee_ids": []})
    assert unassigned.json()["assignees"] == []


def test_assignee_must_be_on_the_board(team, db: Session) -> None:
    owner, mate, mate_user = team
    board_id, todo, _done, category = _board(owner)
    # Not shared yet: the teammate cannot be assigned.
    response = owner.post(
        "/api/v1/tasks",
        json={
            "column_id": todo,
            "category_id": category,
            "title": "Nope",
            "start_date": DAY,
            "due_date": DAY,
            "assignee_ids": [mate_user["id"]],
        },
    )
    assert response.status_code == 422


def test_member_cannot_manage_statuses_board_or_members(team) -> None:
    owner, mate, _mate_user = team
    board_id, todo, _done, _category = _board(owner)
    _share(owner, board_id)

    assert mate.post(
        f"/api/v1/boards/{board_id}/columns", json={"name": "Blocked", "color": "red"}
    ).status_code == 403
    assert mate.patch(f"/api/v1/columns/{todo}", json={"name": "Renamed"}).status_code == 403
    assert mate.post(f"/api/v1/columns/{todo}/archive", json={}).status_code == 403
    assert mate.delete(f"/api/v1/columns/{todo}").status_code == 403
    assert mate.patch(f"/api/v1/boards/{board_id}", json={"name": "Mine now"}).status_code == 403
    assert mate.post(f"/api/v1/boards/{board_id}/archive").status_code == 403
    assert mate.post(
        f"/api/v1/boards/{board_id}/members", json={"email": "someone@example.com"}
    ).status_code == 403
    # Listing statuses is still allowed so the board can render.
    assert mate.get(f"/api/v1/boards/{board_id}/columns").status_code == 200


def test_pending_invitation_joins_on_registration(client: TestClient, db: Session) -> None:
    board_id, *_ = _board(client)
    result = _share(client, board_id, "later@example.com")
    assert result["status"] == "invited"
    assert [item["email"] for item in result["members"]["invitations"]] == ["later@example.com"]

    newcomer = bind_client(db)
    register_user(newcomer, email="Later@example.com", display_name="Later")
    try:
        assert any(item["id"] == board_id for item in newcomer.get("/api/v1/boards").json())
        members = client.get(f"/api/v1/boards/{board_id}/members").json()
        assert members["invitations"] == []
        assert [person["display_name"] for person in members["people"]] == ["Test Owner", "Later"]
    finally:
        app.dependency_overrides.clear()


def test_cancel_invitation(client: TestClient) -> None:
    board_id, *_ = _board(client)
    invitation = _share(client, board_id, "maybe@example.com")["members"]["invitations"][0]
    response = client.delete(f"/api/v1/boards/{board_id}/invitations/{invitation['id']}")
    assert response.status_code == 204
    assert client.get(f"/api/v1/boards/{board_id}/members").json()["invitations"] == []


def test_removing_member_revokes_access_and_unassigns(team) -> None:
    owner, mate, mate_user = team
    board_id, todo, _done, category = _board(owner)
    _share(owner, board_id)
    task = _task(owner, todo, category, "Shared chore", assignee_ids=[mate_user["id"]])

    response = owner.delete(f"/api/v1/boards/{board_id}/members/{mate_user['id']}")
    assert response.status_code == 204
    assert mate.get(f"/api/v1/boards/{board_id}/view", params={"date": DAY}).status_code == 404
    assert mate.get(f"/api/v1/tasks/{task['id']}").status_code == 404
    assert owner.get(f"/api/v1/tasks/{task['id']}").json()["assignees"] == []


def test_member_can_leave_but_not_remove_others(team, db: Session) -> None:
    owner, mate, mate_user = team
    board_id, *_ = _board(owner)
    _share(owner, board_id)
    owner_id = owner.get("/api/v1/auth/me").json()["id"]
    third = bind_client(db)
    third_user = register_user(third, email="third@example.com", display_name="Third")["user"]
    _share(owner, board_id, "third@example.com")

    assert mate.delete(f"/api/v1/boards/{board_id}/members/{third_user['id']}").status_code == 403
    assert mate.delete(f"/api/v1/boards/{board_id}/members/{owner_id}").status_code == 403
    assert mate.delete(f"/api/v1/boards/{board_id}/members/{mate_user['id']}").status_code == 204
    assert all(item["id"] != board_id for item in mate.get("/api/v1/boards").json())


def test_today_shows_shared_tasks_assigned_to_me(team) -> None:
    owner, mate, mate_user = team
    board_id, todo, _done, category = _board(owner)
    _share(owner, board_id)
    _task(owner, todo, category, "Mine to do", assignee_ids=[mate_user["id"]])
    _task(owner, todo, category, "Owner only")

    mate_today = mate.get("/api/v1/today", params={"date": DAY}).json()
    titles = [item["title"] for item in mate_today["active_tasks"]]
    assert "Mine to do" in titles
    assert "Owner only" not in titles

    owner_titles = [item["title"] for item in owner.get("/api/v1/today", params={"date": DAY}).json()["active_tasks"]]
    assert {"Mine to do", "Owner only"} <= set(owner_titles)


def test_outsider_cannot_see_members(team, db: Session) -> None:
    owner, _mate, _mate_user = team
    board_id, *_ = _board(owner)
    outsider = bind_client(db)
    register_user(outsider, email="outsider@example.com")
    assert outsider.get(f"/api/v1/boards/{board_id}/members").status_code == 404
    assert outsider.post(
        f"/api/v1/boards/{board_id}/members", json={"email": "x@example.com"}
    ).status_code == 404


def test_dashboard_task_list_spans_shared_boards(team) -> None:
    owner, mate, mate_user = team
    board_id, todo, done, category = _board(owner)
    _share(owner, board_id)
    _task(owner, todo, category, "Shared open", assignee_ids=[mate_user["id"]])
    finished = _task(owner, todo, category, "Shared finished")
    owner.patch(f"/api/v1/tasks/{finished['id']}/move", json={"target_column_id": done, "expected_version": 1})

    rows = mate.get("/api/v1/dashboard/tasks").json()
    titles = {row["title"] for row in rows["items"]}
    assert "Shared open" in titles and "Shared finished" not in titles
    row = next(row for row in rows["items"] if row["title"] == "Shared open")
    assert row["board_id"] == board_id and [p["display_name"] for p in row["assignees"]] == ["Mate"] and row["is_done"] is False

    everything = mate.get("/api/v1/dashboard/tasks", params={"state": "all", "board_id": board_id}).json()
    assert {"Shared open", "Shared finished"} <= {row["title"] for row in everything["items"]}
    done_rows = mate.get("/api/v1/dashboard/tasks", params={"state": "done"}).json()["items"]
    assert [row["title"] for row in done_rows] == ["Shared finished"]


def test_task_with_several_assignees(team, db: Session) -> None:
    owner, mate, mate_user = team
    board_id, todo, _done, category = _board(owner)
    _share(owner, board_id)
    third = bind_client(db)
    third_user = register_user(third, email="third-assignee@example.com", display_name="Zoe")["user"]
    _share(owner, board_id, "third-assignee@example.com")
    owner_id = owner.get("/api/v1/auth/me").json()["id"]

    task = _task(owner, todo, category, "Team retro", assignee_ids=[mate_user["id"], third_user["id"]])
    assert [person["display_name"] for person in task["assignees"]] == ["Mate", "Zoe"]
    # Both new assignees are told; the person assigning is not.
    assert _notifications(mate, "task_assigned")[0]["task_id"] == task["id"]
    assert _notifications(third, "task_assigned")[0]["task_id"] == task["id"]
    assert _notifications(owner, "task_assigned") == []

    # Adding one more notifies only the newcomer.
    updated = mate.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"assignee_ids": [mate_user["id"], third_user["id"], owner_id]},
    ).json()
    assert len(updated["assignees"]) == 3
    assert len(_notifications(owner, "task_assigned")) == 1
    assert len(_notifications(third, "task_assigned")) == 1

    # Each assignee sees it on Today; removing one member unassigns only them.
    assert "Team retro" in [item["title"] for item in third.get("/api/v1/today", params={"date": DAY}).json()["active_tasks"]]
    owner.delete(f"/api/v1/boards/{board_id}/members/{third_user['id']}")
    remaining = owner.get(f"/api/v1/tasks/{task['id']}").json()["assignees"]
    assert sorted(person["display_name"] for person in remaining) == ["Mate", "Test Owner"]


def test_repeating_task_occurrences_keep_all_assignees(team) -> None:
    owner, mate, mate_user = team
    board_id, todo, _done, category = _board(owner)
    _share(owner, board_id)
    owner_id = owner.get("/api/v1/auth/me").json()["id"]
    created = owner.post(
        "/api/v1/tasks",
        json={
            "column_id": todo,
            "category_id": category,
            "title": "Weekly standup",
            "start_date": DAY,
            "due_date": DAY,
            "recurrence": {"freq": "daily", "interval": 1},
            "assignee_ids": [owner_id, mate_user["id"]],
        },
    )
    assert created.status_code == 201, created.text
    view = owner.get(f"/api/v1/boards/{board_id}/view", params={"unbounded": "true"}).json()
    occurrences = [
        task for column in view["columns"] for task in column["tasks"] if task["title"] == "Weekly standup"
    ]
    assert len(occurrences) > 1
    assert all(len(task["assignees"]) == 2 for task in occurrences)
