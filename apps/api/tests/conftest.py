"""Wspólne fixture'y testów HTTP (TestClient + izolowana baza testowa).

Testy dymne API działają na osobnej bazie ``inzynierka_test`` na tym samym
serwerze PostgreSQL co baza developerska. Każdy test dostaje czyste tabele
(Base.metadata.create_all), więc nic nie przechodzi między testami ani nie
brudzi danych demo.
"""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.db.base import Base
from app.db.dependencies import get_db
from app.main import app

TEST_DATABASE_NAME = "inzynierka_test"


def _test_database_url() -> str:
    # render_as_string z hide_password=False — str(URL) w SQLAlchemy 2 maskuje
    # hasło jako *** i silnik łączyłby się dosłownym ciągiem gwiazdek.
    return make_url(settings.database_url).set(
        database=TEST_DATABASE_NAME
    ).render_as_string(hide_password=False)


def _ensure_test_database() -> None:
    admin_url = make_url(settings.database_url).set(
        database="postgres"
    ).render_as_string(hide_password=False)
    engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    with engine.connect() as connection:
        exists = connection.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :name"),
            {"name": TEST_DATABASE_NAME},
        ).scalar()
        if not exists:
            connection.execute(text(f'CREATE DATABASE "{TEST_DATABASE_NAME}"'))
    engine.dispose()


def _reset_schema() -> None:
    engine = create_engine(_test_database_url())
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    engine.dispose()


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    _ensure_test_database()
    _reset_schema()
    engine = create_engine(_test_database_url())
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
