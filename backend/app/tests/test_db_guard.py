from __future__ import annotations

import pytest

from app.tests.db_guard import DatabaseIsolationError, assert_distinct_database_urls


def test_missing_test_url_is_rejected() -> None:
    with pytest.raises(DatabaseIsolationError, match="TEST_DATABASE_URL is required"):
        assert_distinct_database_urls(None, "postgresql://todo:todo@127.0.0.1:5433/daily_todo")


def test_same_database_is_rejected() -> None:
    url = "postgresql://todo:todo@127.0.0.1:5433/daily_todo"
    with pytest.raises(DatabaseIsolationError, match="different database"):
        assert_distinct_database_urls(url, url)


def test_same_database_different_user_is_rejected() -> None:
    with pytest.raises(DatabaseIsolationError, match="different database"):
        assert_distinct_database_urls(
            "postgresql://other:x@127.0.0.1:5433/daily_todo",
            "postgresql://todo:todo@127.0.0.1:5433/daily_todo",
        )


def test_distinct_database_is_accepted() -> None:
    result = assert_distinct_database_urls(
        "postgresql://todo:todo@127.0.0.1:5433/daily_todo_test",
        "postgresql://todo:todo@127.0.0.1:5433/daily_todo",
    )
    assert result.endswith("daily_todo_test")
