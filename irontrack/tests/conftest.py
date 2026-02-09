import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from irontrack import models
from irontrack.database import Base, get_db
from irontrack.main import app

# In-memory SQLite engine for tests
test_engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

DEFAULT_EXERCISES = [
    "Bench Press", "Squat", "Deadlift", "Overhead Press",
    "Barbell Row", "Pull Ups", "Dips", "Bicep Curls",
]


def _override_get_db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(autouse=True)
def setup_database():
    """Create all tables and seed exercises before each test; drop after."""
    Base.metadata.create_all(bind=test_engine)

    session = TestingSessionLocal()
    for name in DEFAULT_EXERCISES:
        session.add(models.Exercise(id=str(uuid.uuid4()), name=name))
    session.commit()
    session.close()

    yield

    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture()
def client():
    """TestClient with DB override and startup events suppressed."""
    app.dependency_overrides[get_db] = _override_get_db

    original_on_startup = app.router.on_startup[:]
    app.router.on_startup.clear()

    with TestClient(app) as c:
        yield c

    app.router.on_startup = original_on_startup
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_headers(client):
    """Create a test user via the API and return auth headers dict."""
    response = client.post("/auth/signup", json={
        "username": "testuser",
        "password": "testpass123",
    })
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_user(client, username="testuser", password="testpass123"):
    """Helper to create a user and return (user_data, headers)."""
    response = client.post("/auth/signup", json={
        "username": username,
        "password": password,
    })
    assert response.status_code == 200
    data = response.json()
    headers = {"Authorization": f"Bearer {data['access_token']}"}
    return data["user"], headers
