"""Tests for the templates router (/templates endpoints)."""

from tests.conftest import create_user

SAMPLE_EXERCISES = [
    {
        "exerciseId": "ex-1",
        "name": "Bench Press",
        "defaultSets": 3,
        "defaultWeight": 60.0,
        "defaultReps": 8,
    }
]


def _create_template(client, headers, name="Push Day", exercises=None, is_public=False):
    """Helper to create a template and return the response data."""
    response = client.post("/templates/", json={
        "name": name,
        "exercises": exercises or SAMPLE_EXERCISES,
        "isPublic": is_public,
    }, headers=headers)
    assert response.status_code == 200
    return response.json()


class TestCreateTemplate:
    def test_create_template(self, client, auth_headers):
        data = _create_template(client, auth_headers)
        assert data["name"] == "Push Day"
        assert data["isPublic"] is False
        assert len(data["exercises"]) == 1
        assert "id" in data
        assert "createdAt" in data

    def test_create_public_template(self, client, auth_headers):
        data = _create_template(client, auth_headers, is_public=True)
        assert data["isPublic"] is True


class TestListTemplates:
    def test_list_own_templates(self, client, auth_headers):
        _create_template(client, auth_headers, name="Template A")
        _create_template(client, auth_headers, name="Template B")

        response = client.get("/templates/", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_list_sees_public_templates_from_others(self, client):
        _, headers_a = create_user(client, "userA", "passA")
        _create_template(client, headers_a, name="Public Template", is_public=True)

        _, headers_b = create_user(client, "userB", "passB")
        response = client.get("/templates/", headers=headers_b)
        names = [t["name"] for t in response.json()]
        assert "Public Template" in names

    def test_list_hides_private_templates_from_others(self, client):
        _, headers_a = create_user(client, "userA", "passA")
        _create_template(client, headers_a, name="Private Template", is_public=False)

        _, headers_b = create_user(client, "userB", "passB")
        response = client.get("/templates/", headers=headers_b)
        names = [t["name"] for t in response.json()]
        assert "Private Template" not in names


class TestGetTemplate:
    def test_get_own_template(self, client, auth_headers):
        created = _create_template(client, auth_headers)
        response = client.get(f"/templates/{created['id']}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["name"] == "Push Day"

    def test_get_public_template_by_other_user(self, client):
        _, headers_a = create_user(client, "userA", "passA")
        created = _create_template(client, headers_a, is_public=True)

        _, headers_b = create_user(client, "userB", "passB")
        response = client.get(f"/templates/{created['id']}", headers=headers_b)
        assert response.status_code == 200

    def test_get_private_template_by_other_user_forbidden(self, client):
        _, headers_a = create_user(client, "userA", "passA")
        created = _create_template(client, headers_a, is_public=False)

        _, headers_b = create_user(client, "userB", "passB")
        response = client.get(f"/templates/{created['id']}", headers=headers_b)
        assert response.status_code == 403

    def test_get_nonexistent_template(self, client, auth_headers):
        response = client.get("/templates/nonexistent-id", headers=auth_headers)
        assert response.status_code == 404


class TestUpdateTemplate:
    def test_update_own_template(self, client, auth_headers):
        created = _create_template(client, auth_headers)
        response = client.put(f"/templates/{created['id']}", json={
            "name": "Updated Name",
        }, headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Name"

    def test_update_other_users_template_forbidden(self, client):
        _, headers_a = create_user(client, "userA", "passA")
        created = _create_template(client, headers_a)

        _, headers_b = create_user(client, "userB", "passB")
        response = client.put(f"/templates/{created['id']}", json={
            "name": "Hijacked",
        }, headers=headers_b)
        assert response.status_code == 403


class TestDeleteTemplate:
    def test_delete_own_template(self, client, auth_headers):
        created = _create_template(client, auth_headers)
        response = client.delete(f"/templates/{created['id']}", headers=auth_headers)
        assert response.status_code == 200

        response = client.get(f"/templates/{created['id']}", headers=auth_headers)
        assert response.status_code == 404

    def test_delete_other_users_template_forbidden(self, client):
        _, headers_a = create_user(client, "userA", "passA")
        created = _create_template(client, headers_a)

        _, headers_b = create_user(client, "userB", "passB")
        response = client.delete(f"/templates/{created['id']}", headers=headers_b)
        assert response.status_code == 403
