from __future__ import annotations

import ast
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.error_codes import ERROR_MESSAGES, error_code
from app.services.session_service import LOGIN_ERROR

APP_ROOT = Path(__file__).resolve().parents[1]


def _message(node: ast.expr) -> str | None:
    """The text of a string or f-string literal, with every {expression} filled in as "x"."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    if isinstance(node, ast.JoinedStr):
        return "".join(
            part.value if isinstance(part, ast.Constant) else "x" for part in node.values
        )
    return None


def _api_messages() -> set[str]:
    found: set[str] = set()
    for path in APP_ROOT.rglob("*.py"):
        if "tests" in path.parts:
            continue
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if not isinstance(node, ast.Call):
                continue
            name = getattr(node.func, "id", None) or getattr(node.func, "attr", None)
            if name == "HTTPException":
                for keyword in node.keywords:
                    if keyword.arg == "detail" and (text := _message(keyword.value)):
                        found.add(text)
            elif name == "ValueError" and node.args and (text := _message(node.args[0])):
                found.add(text)
    return found


def test_every_api_error_message_has_a_code() -> None:
    messages = _api_messages() | {LOGIN_ERROR}
    assert len(messages) > 80
    missing = sorted(message for message in messages if error_code(message) is None)
    assert missing == []


def test_templates_return_their_parameters() -> None:
    assert error_code("ada@example.com has already been invited") == (
        "already_invited",
        {"email": "ada@example.com"},
    )
    assert error_code("File exceeds 10485760 bytes") == ("file_too_large", {"bytes": "10485760"})
    # A fixed message wins over a template that would also match it.
    assert error_code("category_id cannot be null") == ("category_id_null", {})
    assert len(set(ERROR_MESSAGES.values())) == len(ERROR_MESSAGES)


def test_error_responses_carry_code_and_params(client: TestClient) -> None:
    missing = client.get("/api/v1/tasks/00000000-0000-4000-8000-000000000000")
    assert missing.status_code == 404
    assert missing.json() == {"detail": "Task not found", "code": "task_not_found", "params": {}}

    invalid = client.post("/api/v1/boards", json={"name": "   "})
    assert invalid.status_code == 422
    assert invalid.json()["code"] == "board_name_required"
    assert isinstance(invalid.json()["detail"], list)

    unknown_shape = client.post("/api/v1/boards", json={})
    assert unknown_shape.status_code == 422
    assert unknown_shape.json()["code"] == "validation_failed"
