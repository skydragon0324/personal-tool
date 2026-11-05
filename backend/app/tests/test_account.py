from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.main import app
from app.models import User, UserSession
from app.tests.auth_helpers import TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD, bind_client, register_user

NEW_PASSWORD = "brand-new-password"


def _login(client: TestClient, email: str, password: str):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def test_update_name_without_password(client: TestClient) -> None:
    response = client.patch("/api/v1/auth/me", json={"display_name": "  Renamed  "})
    assert response.status_code == 200, response.text
    assert response.json()["display_name"] == "Renamed"
    assert client.get("/api/v1/auth/me").json()["display_name"] == "Renamed"

    blank = client.patch("/api/v1/auth/me", json={"display_name": "   "})
    assert blank.status_code == 422


def test_change_email_needs_current_password(client: TestClient) -> None:
    missing = client.patch("/api/v1/auth/me", json={"email": "new@example.com"})
    assert missing.status_code == 400
    assert missing.json()["code"] == "current_password_required"

    wrong = client.patch(
        "/api/v1/auth/me", json={"email": "new@example.com", "current_password": "not-the-password"}
    )
    assert wrong.status_code == 400
    assert wrong.json()["code"] == "current_password_wrong"

    ok = client.patch(
        "/api/v1/auth/me", json={"email": "New@Example.com", "current_password": TEST_OWNER_PASSWORD}
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["email"] == "new@example.com"

    client.post("/api/v1/auth/logout")
    assert _login(client, TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD).status_code == 401
    assert _login(client, "new@example.com", TEST_OWNER_PASSWORD).status_code == 200


def test_same_email_in_other_case_needs_no_password(client: TestClient) -> None:
    response = client.patch("/api/v1/auth/me", json={"email": TEST_OWNER_EMAIL.upper()})
    assert response.status_code == 200, response.text
    assert response.json()["email"] == TEST_OWNER_EMAIL


def test_cannot_take_another_users_email(client: TestClient, db: Session) -> None:
    other = bind_client(db)
    register_user(other, email="taken@example.com", display_name="Other")
    response = client.patch(
        "/api/v1/auth/me", json={"email": "Taken@example.com", "current_password": TEST_OWNER_PASSWORD}
    )
    assert response.status_code == 409
    assert response.json()["code"] == "email_already_registered"


def test_new_email_picks_up_pending_invitations(client: TestClient, db: Session) -> None:
    newcomer = bind_client(db)
    register_user(newcomer, email="someone@example.com", display_name="Someone")
    try:
        board_id = next(item["id"] for item in client.get("/api/v1/boards").json() if item["role"] == "owner")
        invited = client.post(f"/api/v1/boards/{board_id}/members", json={"email": "work@example.com"})
        assert invited.status_code == 201, invited.text
        assert invited.json()["status"] == "invited"

        changed = newcomer.patch(
            "/api/v1/auth/me", json={"email": "work@example.com", "current_password": TEST_OWNER_PASSWORD}
        )
        assert changed.status_code == 200, changed.text
        assert any(item["id"] == board_id for item in newcomer.get("/api/v1/boards").json())
    finally:
        app.dependency_overrides.clear()


def test_change_password(client: TestClient, db: Session) -> None:
    wrong = client.post(
        "/api/v1/auth/password", json={"current_password": "not-the-password", "new_password": NEW_PASSWORD}
    )
    assert wrong.status_code == 400
    assert wrong.json()["code"] == "current_password_wrong"

    too_short = client.post(
        "/api/v1/auth/password", json={"current_password": TEST_OWNER_PASSWORD, "new_password": "short"}
    )
    assert too_short.status_code == 422

    ok = client.post(
        "/api/v1/auth/password", json={"current_password": TEST_OWNER_PASSWORD, "new_password": NEW_PASSWORD}
    )
    assert ok.status_code == 204, ok.text
    user = db.scalar(select(User).where(User.email == TEST_OWNER_EMAIL))
    assert user is not None and verify_password(NEW_PASSWORD, user.password_hash)
    # This session stays signed in.
    assert client.get("/api/v1/auth/me").status_code == 200

    client.post("/api/v1/auth/logout")
    assert _login(client, TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD).status_code == 401
    assert _login(client, TEST_OWNER_EMAIL, NEW_PASSWORD).status_code == 200


def test_change_password_signs_out_other_sessions(client: TestClient, db: Session) -> None:
    other_device = bind_client(db)
    assert _login(other_device, TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD).status_code == 200
    assert other_device.get("/api/v1/auth/me").status_code == 200

    ok = client.post(
        "/api/v1/auth/password", json={"current_password": TEST_OWNER_PASSWORD, "new_password": NEW_PASSWORD}
    )
    assert ok.status_code == 204, ok.text
    assert client.get("/api/v1/auth/me").status_code == 200
    assert other_device.get("/api/v1/auth/me").status_code == 401

    user = db.scalar(select(User).where(User.email == TEST_OWNER_EMAIL))
    sessions = db.scalars(select(UserSession).where(UserSession.user_id == user.id)).all()
    assert len(sessions) == 1


def test_account_endpoints_need_sign_in(anonymous_client: TestClient) -> None:
    assert anonymous_client.patch("/api/v1/auth/me", json={"display_name": "X"}).status_code == 401
    assert (
        anonymous_client.post(
            "/api/v1/auth/password", json={"current_password": "a", "new_password": NEW_PASSWORD}
        ).status_code
        == 401
    )
