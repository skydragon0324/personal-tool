from __future__ import annotations

from urllib.parse import urlparse


class DatabaseIsolationError(RuntimeError):
    """Raised when tests would otherwise touch the development database."""


def _identity(url: str) -> tuple[str, str, str]:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    port = str(parsed.port or (5432 if parsed.scheme.startswith("postgres") else ""))
    name = (parsed.path or "").lstrip("/").lower()
    return host, port, name


def assert_distinct_database_urls(test_url: str | None, dev_url: str | None) -> str:
    test = (test_url or "").strip()
    if not test:
        raise DatabaseIsolationError(
            "TEST_DATABASE_URL is required. Tests refuse to use the development database. "
            "Create a dedicated database (for example `daily_todo_test`) and set "
            "TEST_DATABASE_URL in backend/.env. See README."
        )
    dev = (dev_url or "").strip()
    if not dev:
        return test
    if _identity(test) == _identity(dev) or test.rstrip("/").lower() == dev.rstrip("/").lower():
        raise DatabaseIsolationError(
            "TEST_DATABASE_URL must be a different database than DATABASE_URL. "
            "Refusing to run tests against the development database."
        )
    return test
