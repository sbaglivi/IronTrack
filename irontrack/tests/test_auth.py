"""Tests for the auth router (/auth endpoints)."""


class TestSignup:
    def test_signup_success(self, client):
        response = client.post("/auth/signup", json={
            "username": "newuser",
            "password": "password123",
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["username"] == "newuser"
        assert "id" in data["user"]

    def test_signup_duplicate_username(self, client):
        client.post("/auth/signup", json={
            "username": "dupuser", "password": "pass123",
        })
        response = client.post("/auth/signup", json={
            "username": "dupuser", "password": "otherpass",
        })
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"]


class TestLogin:
    def test_login_success(self, client):
        client.post("/auth/signup", json={
            "username": "loginuser", "password": "mypassword",
        })
        response = client.post("/auth/login", json={
            "username": "loginuser", "password": "mypassword",
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["username"] == "loginuser"

    def test_login_wrong_password(self, client):
        client.post("/auth/signup", json={
            "username": "loginuser", "password": "mypassword",
        })
        response = client.post("/auth/login", json={
            "username": "loginuser", "password": "wrongpassword",
        })
        assert response.status_code == 401

    def test_login_nonexistent_user(self, client):
        response = client.post("/auth/login", json={
            "username": "nobody", "password": "irrelevant",
        })
        assert response.status_code == 401


class TestMe:
    def test_me_authenticated(self, client, auth_headers):
        response = client.get("/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "testuser"
        assert "id" in data

    def test_me_no_token(self, client):
        response = client.get("/auth/me")
        assert response.status_code == 403

    def test_me_invalid_token(self, client):
        response = client.get("/auth/me", headers={
            "Authorization": "Bearer invalid.token.here",
        })
        assert response.status_code == 401
