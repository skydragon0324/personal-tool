from __future__ import annotations

import os
from collections.abc import Generator
from datetime import date
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.constants import COLUMN_DONE_ID, COLUMN_IN_PROGRESS_ID, COLUMN_TODO_ID, DEFAULT_BOARD_ID
from app.db.session import get_db
from app.main import app
from app.models import Task

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://todo:todo@localhost:5432/daily_todo")


def _db_available() -> bool:
    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _db_available(), reason="PostgreSQL not available")


@pytest.fixture()
def db() -> Generator[Session, None, None]:
    engine = create_engine(DATABASE_URL)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSession()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


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
def seed_tasks(db: Session, today: date) -> list[Task]:
    db.execute(text("DELETE FROM tasks"))
    db.commit()

    tasks = [
        Task(
            id=uuid4(),
            column_id=COLUMN_TODO_ID,
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
