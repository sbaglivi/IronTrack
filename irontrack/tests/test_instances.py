"""Tests for the instances router (/instances endpoints)."""

import time

from tests.conftest import create_user

SAMPLE_EXERCISES = [
    {
        "exerciseId": "ex-1",
        "name": "Bench Press",
        "sets": [
            {"id": "set-1", "weight": 60.0, "reps": 8, "completed": True},
            {"id": "set-2", "weight": 60.0, "reps": 8, "completed": False},
        ],
    }
]


def _create_instance(client, headers, name="Morning Workout", is_draft=False, date=None):
    """Helper to create a workout instance."""
    response = client.post("/instances/", json={
        "name": name,
        "date": date or int(time.time() * 1000),
        "exercises": SAMPLE_EXERCISES,
        "notes": "Felt good",
        "isDraft": is_draft,
    }, headers=headers)
    assert response.status_code == 200
    return response.json()


class TestCreateInstance:
    def test_create_instance(self, client, auth_headers):
        data = _create_instance(client, auth_headers)
        assert data["name"] == "Morning Workout"
        assert data["isDraft"] is False
        assert len(data["exercises"]) == 1
        assert data["notes"] == "Felt good"

    def test_create_draft_instance(self, client, auth_headers):
        data = _create_instance(client, auth_headers, is_draft=True)
        assert data["isDraft"] is True


class TestListInstances:
    def test_list_excludes_drafts_by_default(self, client, auth_headers):
        _create_instance(client, auth_headers, name="Completed", is_draft=False)
        _create_instance(client, auth_headers, name="In Progress", is_draft=True)

        response = client.get("/instances/", headers=auth_headers)
        assert response.status_code == 200
        names = [i["name"] for i in response.json()]
        assert "Completed" in names
        assert "In Progress" not in names

    def test_list_includes_drafts_when_requested(self, client, auth_headers):
        _create_instance(client, auth_headers, name="Completed", is_draft=False)
        _create_instance(client, auth_headers, name="In Progress", is_draft=True)

        response = client.get("/instances/?include_drafts=true", headers=auth_headers)
        names = [i["name"] for i in response.json()]
        assert "Completed" in names
        assert "In Progress" in names

    def test_list_only_own_instances(self, client):
        _, headers_a = create_user(client, "userA", "passA")
        _create_instance(client, headers_a, name="A's Workout")

        _, headers_b = create_user(client, "userB", "passB")
        _create_instance(client, headers_b, name="B's Workout")

        response = client.get("/instances/", headers=headers_a)
        instances = response.json()
        assert len(instances) == 1
        assert instances[0]["name"] == "A's Workout"

    def test_list_ordered_by_date_descending(self, client, auth_headers):
        _create_instance(client, auth_headers, name="Older", date=1000)
        _create_instance(client, auth_headers, name="Newer", date=2000)

        response = client.get("/instances/", headers=auth_headers)
        instances = response.json()
        assert instances[0]["name"] == "Newer"
        assert instances[1]["name"] == "Older"


class TestGetDraft:
    def test_get_draft_returns_most_recent(self, client, auth_headers):
        _create_instance(client, auth_headers, name="Old Draft", is_draft=True, date=1000)
        _create_instance(client, auth_headers, name="New Draft", is_draft=True, date=2000)

        response = client.get("/instances/draft", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["name"] == "New Draft"

    def test_get_draft_returns_null_when_none(self, client, auth_headers):
        response = client.get("/instances/draft", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() is None


class TestCompleteDraft:
    def test_complete_draft_sets_is_draft_false(self, client, auth_headers):
        draft = _create_instance(client, auth_headers, is_draft=True)
        assert draft["isDraft"] is True

        response = client.put(f"/instances/{draft['id']}", json={
            "isDraft": False,
        }, headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["isDraft"] is False

        # Should now appear in normal list
        response = client.get("/instances/", headers=auth_headers)
        ids = [i["id"] for i in response.json()]
        assert draft["id"] in ids


class TestGetInstance:
    def test_get_own_instance(self, client, auth_headers):
        created = _create_instance(client, auth_headers)
        response = client.get(f"/instances/{created['id']}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["name"] == "Morning Workout"

    def test_get_other_users_instance_forbidden(self, client):
        _, headers_a = create_user(client, "userA", "passA")
        created = _create_instance(client, headers_a)

        _, headers_b = create_user(client, "userB", "passB")
        response = client.get(f"/instances/{created['id']}", headers=headers_b)
        assert response.status_code == 403

    def test_get_nonexistent_instance(self, client, auth_headers):
        response = client.get("/instances/nonexistent", headers=auth_headers)
        assert response.status_code == 404


class TestUpdateInstance:
    def test_update_instance_name(self, client, auth_headers):
        created = _create_instance(client, auth_headers)
        response = client.put(f"/instances/{created['id']}", json={
            "name": "Evening Workout",
        }, headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["name"] == "Evening Workout"

    def test_update_other_users_instance_forbidden(self, client):
        _, headers_a = create_user(client, "userA", "passA")
        created = _create_instance(client, headers_a)

        _, headers_b = create_user(client, "userB", "passB")
        response = client.put(f"/instances/{created['id']}", json={
            "name": "Hijacked",
        }, headers=headers_b)
        assert response.status_code == 403


class TestDeleteInstance:
    def test_delete_own_instance(self, client, auth_headers):
        created = _create_instance(client, auth_headers)
        response = client.delete(f"/instances/{created['id']}", headers=auth_headers)
        assert response.status_code == 200

        response = client.get(f"/instances/{created['id']}", headers=auth_headers)
        assert response.status_code == 404

    def test_delete_other_users_instance_forbidden(self, client):
        _, headers_a = create_user(client, "userA", "passA")
        created = _create_instance(client, headers_a)

        _, headers_b = create_user(client, "userB", "passB")
        response = client.delete(f"/instances/{created['id']}", headers=headers_b)
        assert response.status_code == 403
