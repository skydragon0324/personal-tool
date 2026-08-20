from __future__ import annotations

from datetime import UTC, datetime, timedelta
from io import BytesIO
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.constants import BOOTSTRAP_USER_ID, DEFAULT_BOARD_ID
from app.core.security import verify_password
from app.main import app
from app.models import User, UserSession
from app.tests.auth_helpers import (
    TEST_OWNER_PASSWORD,
    bind_client,
    register_user,
)


def _second_client(db: Session) -> TestClient:
    return bind_client(db)


def test_health_is_public(anonymous_client: TestClient) -> None:
    response = anonymous_client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_unauthenticated_api_is_rejected(anonymous_client: TestClient) -> None:
    assert anonymous_client.get("/api/v1/boards").status_code == 401
    assert anonymous_client.get("/api/v1/notes").status_code == 401
    assert anonymous_client.get("/api/v1/schedule", params={"week_start": "2026-08-17", "today": "2026-08-20"}).status_code == 401
    assert anonymous_client.get("/api/v1/dashboard/summary", params={"today": "2026-08-20"}).status_code == 401
    assert anonymous_client.get("/api/v1/auth/me").status_code == 401


def test_first_register_claims_legacy_data(anonymous_client: TestClient, db: Session) -> None:
    body = register_user(anonymous_client, email="first@example.com")
    assert body["user"]["email"] == "first@example.com"
    assert body["user"]["id"] == str(BOOTSTRAP_USER_ID)
    assert "csrf_token" in body
    assert "password" not in body["user"]
    assert "password_hash" not in body["user"]

    user = db.get(User, BOOTSTRAP_USER_ID)
    assert user is not None
    assert user.is_bootstrap is False
    assert user.email == "first@example.com"
    assert verify_password("test-password-ok", user.password_hash)

    boards = anonymous_client.get("/api/v1/boards").json()
    assert any(item["id"] == str(DEFAULT_BOARD_ID) for item in boards)

    me = anonymous_client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "first@example.com"


def test_second_register_gets_empty_personal_workspace(db: Session) -> None:
    first = bind_client(db)
    register_user(first, email="alpha@example.com")
    second = _second_client(db)
    body = register_user(second, email="beta@example.com", display_name="Beta")
    assert body["user"]["id"] != str(BOOTSTRAP_USER_ID)

    boards = second.get("/api/v1/boards").json()
    assert len(boards) == 1
    assert boards[0]["name"] == "Personal"
    assert boards[0]["id"] != str(DEFAULT_BOARD_ID)

    columns = second.get(f"/api/v1/boards/{boards[0]['id']}/columns").json()
    names = [item["name"] for item in columns if item["archived_at"] is None]
    assert names == ["To Do", "In Progress", "Done"]
    categories = second.get(f"/api/v1/boards/{boards[0]['id']}/categories").json()
    assert [item["name"] for item in categories] == ["Uncategorized"]

    assert second.get(f"/api/v1/boards/{DEFAULT_BOARD_ID}").status_code == 404
    assert str(DEFAULT_BOARD_ID) in {item["id"] for item in first.get("/api/v1/boards").json()}
    app.dependency_overrides.clear()


def test_email_is_normalized_and_unique(anonymous_client: TestClient, db: Session) -> None:
    register_user(anonymous_client, email="Person@Example.COM")
    me = anonymous_client.get("/api/v1/auth/me").json()
    assert me["email"] == "person@example.com"

    other = bind_client(db)
    duplicate = other.post(
        "/api/v1/auth/register",
        json={
            "display_name": "Other",
            "email": "PERSON@example.com",
            "password": "another-pass-1",
            "timezone": "UTC",
        },
    )
    assert duplicate.status_code == 409
    app.dependency_overrides.clear()


def test_password_minimum_length(anonymous_client: TestClient) -> None:
    response = anonymous_client.post(
        "/api/v1/auth/register",
        json={
            "display_name": "Short",
            "email": "short@example.com",
            "password": "123456789",
            "timezone": "UTC",
        },
    )
    assert response.status_code == 422


def test_login_logout_and_wrong_password(anonymous_client: TestClient) -> None:
    register_user(anonymous_client, email="login@example.com")
    anonymous_client.post("/api/v1/auth/logout")
    me = anonymous_client.get("/api/v1/auth/me")
    assert me.status_code == 401

    wrong = anonymous_client.post(
        "/api/v1/auth/login",
        json={"email": "login@example.com", "password": "not-the-password"},
    )
    missing = anonymous_client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "not-the-password"},
    )
    assert wrong.status_code == 401
    assert missing.status_code == 401
    assert wrong.json()["detail"] == missing.json()["detail"]
    assert "email" not in wrong.json()["detail"].lower() or "or password" in wrong.json()["detail"].lower()

    ok = anonymous_client.post(
        "/api/v1/auth/login",
        json={"email": "LOGIN@example.com", "password": TEST_OWNER_PASSWORD},
    )
    assert ok.status_code == 200, ok.text
    assert anonymous_client.get("/api/v1/auth/me").status_code == 200


def test_bootstrap_user_cannot_login(anonymous_client: TestClient, db: Session) -> None:
    from app.core.constants import BOOTSTRAP_EMAIL

    response = anonymous_client.post(
        "/api/v1/auth/login",
        json={"email": BOOTSTRAP_EMAIL, "password": "anything-at-all"},
    )
    assert response.status_code == 401
    user = db.get(User, BOOTSTRAP_USER_ID)
    assert user is not None
    assert user.is_bootstrap is True


def test_csrf_failure_on_mutation(client: TestClient) -> None:
    client.auto_csrf = False  # type: ignore[attr-defined]
    origin = get_settings().cors_origin_list[0]
    response = client.post(
        "/api/v1/boards",
        json={"name": f"CSRF-{uuid4().hex[:8]}", "timezone": "UTC"},
        headers={"Origin": origin, "X-CSRF-Token": "invalid-token"},
    )
    assert response.status_code == 403
    assert "CSRF" in response.json()["detail"]


def test_invalid_origin_is_rejected(client: TestClient) -> None:
    client.auto_origin = False  # type: ignore[attr-defined]
    response = client.post(
        "/api/v1/boards",
        json={"name": f"Origin-{uuid4().hex[:8]}", "timezone": "UTC"},
        headers={"Origin": "http://evil.example"},
    )
    assert response.status_code == 403


def test_expired_session_is_rejected(client: TestClient, db: Session) -> None:
    session = db.scalar(select(UserSession))
    assert session is not None
    session.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db.commit()
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_users_cannot_access_each_others_resources(db: Session, today) -> None:
    first = bind_client(db)
    register_user(first, email="owner-a@example.com")
    note = first.post("/api/v1/notes", json={"title": "Private note", "body": "secret"}).json()
    entry = first.post(
        "/api/v1/schedule",
        json={
            "title": "Private block",
            "kind": "routine",
            "weekdays": [0],
            "start_time": "09:00:00",
            "end_time": "10:00:00",
            "color": "teal",
        },
    ).json()
    task = first.post(
        "/api/v1/tasks",
        json={
            "column_id": str(
                next(
                    item["id"]
                    for item in first.get(f"/api/v1/boards/{DEFAULT_BOARD_ID}/columns").json()
                    if item["name"] == "To Do"
                )
            ),
            "category_id": first.get(f"/api/v1/boards/{DEFAULT_BOARD_ID}/categories").json()[0]["id"],
            "title": "Private task",
            "due_date": str(today),
        },
    ).json()
    files = {"file": ("secret.txt", BytesIO(b"secret-bytes"), "text/plain")}
    attachment = first.post(f"/api/v1/tasks/{task['id']}/attachments", files=files).json()
    column_id = task["column_id"]
    category_id = task["category"]["id"]

    second = _second_client(db)
    register_user(second, email="owner-b@example.com")
    second_board = second.get("/api/v1/boards").json()[0]["id"]

    assert second.get(f"/api/v1/boards/{DEFAULT_BOARD_ID}").status_code == 404
    assert second.get(f"/api/v1/boards/{DEFAULT_BOARD_ID}/view").status_code == 404
    assert second.get(f"/api/v1/notes/{note['id']}").status_code == 404
    assert second.patch(f"/api/v1/notes/{note['id']}", json={"title": "Stolen"}).status_code == 404
    assert second.delete(f"/api/v1/notes/{note['id']}").status_code == 404
    assert second.get(f"/api/v1/schedule/{entry['id']}").status_code == 404
    assert second.get(f"/api/v1/tasks/{task['id']}").status_code == 404
    assert second.patch(f"/api/v1/tasks/{task['id']}", json={"title": "Stolen"}).status_code == 404
    assert (
        second.get(f"/api/v1/tasks/{task['id']}/attachments/{attachment['id']}/download").status_code
        == 404
    )
    assert second.delete(f"/api/v1/tasks/{task['id']}/attachments/{attachment['id']}").status_code == 404
    assert second.patch(f"/api/v1/columns/{column_id}", json={"name": "Hacked"}).status_code == 404

    stolen_task = second.post(
        "/api/v1/tasks",
        json={
            "column_id": column_id,
            "category_id": second.get(f"/api/v1/boards/{second_board}/categories").json()[0]["id"],
            "title": "Injected",
            "due_date": str(today),
        },
    )
    assert stolen_task.status_code == 404

    notes = second.get("/api/v1/notes").json()
    assert note["id"] not in {item["id"] for item in notes}
    summary = second.get("/api/v1/dashboard/summary", params={"today": str(today)}).json()
    assert str(DEFAULT_BOARD_ID) not in {item["id"] for item in summary["boards"]}
    app.dependency_overrides.clear()


def test_board_name_and_position_are_unique_per_user(db: Session) -> None:
    first = bind_client(db)
    register_user(first, email="unique-a@example.com")
    second = _second_client(db)
    register_user(second, email="unique-b@example.com")

    created = second.post("/api/v1/boards", json={"name": "Personal", "timezone": "UTC"})
    assert created.status_code == 409

    named = first.post("/api/v1/boards", json={"name": "Shared Name", "timezone": "UTC"})
    assert named.status_code == 201, named.text
    other = second.post("/api/v1/boards", json={"name": "Shared Name", "timezone": "UTC"})
    assert other.status_code == 201, other.text

    first_positions = {item["position"] for item in first.get("/api/v1/boards").json() if item["archived_at"] is None}
    second_positions = {item["position"] for item in second.get("/api/v1/boards").json() if item["archived_at"] is None}
    assert 0 in first_positions
    assert 0 in second_positions
    app.dependency_overrides.clear()
