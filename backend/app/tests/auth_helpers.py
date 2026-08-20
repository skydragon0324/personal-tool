from __future__ import annotations

from collections.abc import Generator
from typing import Any

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.db.session import get_db
from app.main import app

MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
TEST_OWNER_EMAIL = "owner@example.com"
TEST_OWNER_PASSWORD = "test-password-ok"
TEST_OWNER_NAME = "Test Owner"


class CsrfTestClient(TestClient):
    auto_origin = True
    auto_csrf = True

    def request(self, method: str, url: str, **kwargs: Any):  # type: ignore[override]
        headers = dict(kwargs.get("headers") or {})
        if method.upper() in MUTATING_METHODS:
            if self.auto_origin and not any(str(key).lower() == "origin" for key in headers):
                origins = get_settings().cors_origin_list
                headers["Origin"] = origins[0] if origins else "http://localhost:3000"
            if self.auto_csrf and not any(str(key).lower() == "x-csrf-token" for key in headers):
                csrf = self.cookies.get(get_settings().csrf_cookie_name)
                if csrf:
                    headers[get_settings().csrf_header_name] = csrf
        kwargs["headers"] = headers
        return super().request(method, url, **kwargs)


def bind_client(db) -> CsrfTestClient:
    def override_get_db() -> Generator:
        yield db

    app.dependency_overrides[get_db] = override_get_db
    return CsrfTestClient(app)


def register_payload(
    *,
    email: str,
    password: str = TEST_OWNER_PASSWORD,
    display_name: str = TEST_OWNER_NAME,
    timezone: str = "UTC",
) -> dict[str, str]:
    return {
        "display_name": display_name,
        "email": email,
        "password": password,
        "timezone": timezone,
    }


def register_user(client: TestClient, **kwargs: str) -> dict:
    email = kwargs.pop("email")
    response = client.post("/api/v1/auth/register", json=register_payload(email=email, **kwargs))
    assert response.status_code == 201, response.text
    return response.json()
