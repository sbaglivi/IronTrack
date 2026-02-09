"""Tests for the exercises router (/exercises endpoints)."""



class TestListExercises:
    def test_list_includes_seeded_exercises(self, client, auth_headers):
        response = client.get("/exercises/", headers=auth_headers)
        assert response.status_code == 200
        exercises = response.json()
        assert len(exercises) >= 8
        names = {e["name"] for e in exercises}
        assert "Bench Press" in names
        assert "Squat" in names
        assert "Deadlift" in names

    def test_list_exercises_unauthenticated(self, client):
        response = client.get("/exercises/")
        assert response.status_code == 403


class TestCreateExercise:
    def test_create_new_exercise(self, client, auth_headers):
        response = client.post("/exercises/", json={"name": "Lunges"}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Lunges"
        assert "id" in data

    def test_create_duplicate_returns_existing(self, client, auth_headers):
        response = client.post("/exercises/", json={"name": "Bench Press"}, headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["name"] == "Bench Press"

        # Verify no duplicate was created
        all_exercises = client.get("/exercises/", headers=auth_headers).json()
        bench_count = sum(1 for e in all_exercises if e["name"] == "Bench Press")
        assert bench_count == 1
