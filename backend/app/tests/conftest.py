from __future__ import annotations

import os
from collections.abc import Generator
from datetime import date
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from alembic import command
from alembic.config import Config
from dotenv import load_dotenv
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.core.constants import COLUMN_DONE_ID, COLUMN_IN_PROGRESS_ID, COLUMN_TODO_ID, DEFAULT_BOARD_ID
from app.db.session import get_db
from app.main import app
from app.models import BoardColumn, Category, Task
from app.tests.db_guard import DatabaseIsolationError, assert_distinct_database_urls

BACKEND_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_ROOT / ".env")


def _test_database_url() -> str:
    settings = get_settings()
    return assert_distinct_database_urls(
        os.getenv("TEST_DATABASE_URL") or settings.test_database_url,
        os.getenv("DATABASE_URL") or settings.database_url,
    )


def pytest_configure() -> None:
    try:
        _test_database_url()
    except DatabaseIsolationError as exc:
        raise pytest.UsageError(str(exc)) from exc


@pytest.fixture(scope="session")
def test_engine():
    url = _test_database_url()
    engine = create_engine(url, pool_pre_ping=True)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        engine.dispose()
        raise pytest.UsageError(
            "Could not connect to TEST_DATABASE_URL. Create the test database first, for example:\n"
            "  CREATE DATABASE daily_todo_test;\n"
            f"Original error: {exc}"
        ) from exc

    alembic_cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
    os.environ["ALEMBIC_DATABASE_URL"] = url
    alembic_cfg.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    command.upgrade(alembic_cfg, "head")
    with engine.connect() as conn:
        conn.execute(text("SELECT 1 FROM board_columns LIMIT 1"))
    yield engine
    engine.dispose()


@pytest.fixture()
def db(test_engine) -> Generator[Session, None, None]:
    connection = test_engine.connect()
    transaction = connection.begin()
    TestingSession = sessionmaker(
        bind=connection,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client(db: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def today() -> date:
    return date.today()


@pytest.fixture()
def uncategorized_id(db: Session) -> UUID:
    category = db.scalar(
        select(Category).where(
            Category.board_id == DEFAULT_BOARD_ID,
            Category.name == "Uncategorized",
        )
    )
    if category is None:
        category = Category(
            board_id=DEFAULT_BOARD_ID,
            name="Uncategorized",
            color="gray",
            position=0,
        )
        db.add(category)
        db.commit()
        db.refresh(category)
    return category.id


@pytest.fixture()
def seed_tasks(db: Session, today: date, uncategorized_id: UUID) -> list[Task]:
    db.execute(text("DELETE FROM task_subtasks"))
    db.execute(text("DELETE FROM tasks"))
    db.commit()

    tasks = [
        Task(
            id=uuid4(),
            column_id=COLUMN_TODO_ID,
            category_id=uncategorized_id,
            title="Alpha",
            description=None,
            due_date=today,
            priority="medium",
            position=0,
            version=1,
        ),
        Task(
            id=uuid4(),
            column_id=COLUMN_TODO_ID,
            category_id=uncategorized_id,
            title="Bravo",
            description=None,
            due_date=today,
            priority="high",
            position=1,
            version=1,
        ),
        Task(
            id=uuid4(),
            column_id=COLUMN_TODO_ID,
            category_id=uncategorized_id,
            title="Charlie",
            description=None,
            due_date=today,
            priority="low",
            position=2,
            version=1,
        ),
    ]
    db.add_all(tasks)
    db.commit()
    for task in tasks:
        db.refresh(task)
    return tasks


@pytest.fixture(autouse=True)
def ensure_default_columns_active(db: Session) -> None:
    """Keep seed status IDs usable even if a previous test archived them."""
    expected_done = {
        COLUMN_TODO_ID: False,
        COLUMN_IN_PROGRESS_ID: False,
        COLUMN_DONE_ID: True,
    }
    changed = False
    for column_id, is_done in expected_done.items():
        column = db.get(BoardColumn, column_id)
        if column is None:
            continue
        if column.archived_at is not None:
            column.archived_at = None
            changed = True
        if column.is_done != is_done:
            column.is_done = is_done
            changed = True
    if changed:
        db.commit()
