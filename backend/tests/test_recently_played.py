"""
Backend tests for GET /api/games/recently-played endpoint
Tests: auth enforcement, response structure, seeded admin data
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("NEXT_PUBLIC_API_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback: read from frontend .env
    import subprocess
    result = subprocess.run(
        ["grep", "NEXT_PUBLIC_API_URL", "/app/frontend/.env"],
        capture_output=True, text=True
    )
    if result.stdout:
        BASE_URL = result.stdout.strip().split("=", 1)[1].strip()

ADMIN_EMAIL = "admin@hypd.games"
ADMIN_PASSWORD = "admin123"


# ---- Fixtures ----

@pytest.fixture(scope="module")
def admin_token():
    """Login as admin and return access token"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
    })
    assert resp.status_code == 200, f"Admin login failed: {resp.status_code} {resp.text}"
    data = resp.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in response: {data}"
    return token


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---- Tests: 401 / auth enforcement ----

class TestRecentlyPlayedAuth:
    """Verify that the endpoint enforces authentication"""

    def test_no_token_returns_401_or_403(self):
        """GET /api/games/recently-played without any token should return 401 or 403"""
        resp = requests.get(f"{BASE_URL}/api/games/recently-played")
        assert resp.status_code in (401, 403), (
            f"Expected 401/403 without token, got {resp.status_code}: {resp.text}"
        )
        print(f"PASS: No token → {resp.status_code} (auth enforced)")

    def test_invalid_token_returns_401(self):
        """GET /api/games/recently-played with garbage token should return 401"""
        resp = requests.get(
            f"{BASE_URL}/api/games/recently-played",
            headers={"Authorization": "Bearer invalid_token_xyz"},
        )
        assert resp.status_code == 401, (
            f"Expected 401 with invalid token, got {resp.status_code}: {resp.text}"
        )
        print("PASS: Invalid token → 401")


# ---- Tests: Admin with seeded data ----

class TestRecentlyPlayedAdminData:
    """Verify recently-played returns correct data for admin user"""

    def test_recently_played_returns_200(self, admin_headers):
        """Authenticated admin should get 200"""
        resp = requests.get(
            f"{BASE_URL}/api/games/recently-played",
            headers=admin_headers,
        )
        assert resp.status_code == 200, (
            f"Expected 200 for admin, got {resp.status_code}: {resp.text}"
        )
        print("PASS: Admin → 200")

    def test_recently_played_returns_list(self, admin_headers):
        """Response should be a JSON array"""
        resp = requests.get(
            f"{BASE_URL}/api/games/recently-played",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}: {data}"
        print(f"PASS: Response is a list with {len(data)} items")

    def test_recently_played_has_at_least_one_game(self, admin_headers):
        """Admin has 3 seeded play sessions — must return at least 1 game"""
        resp = requests.get(
            f"{BASE_URL}/api/games/recently-played",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1, (
            f"Expected at least 1 recently-played game for admin, got {len(data)}"
        )
        print(f"PASS: Admin has {len(data)} recently-played game(s)")

    def test_recently_played_game_has_required_fields(self, admin_headers):
        """Each game object must have id, title, category fields"""
        resp = requests.get(
            f"{BASE_URL}/api/games/recently-played",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        if not data:
            pytest.skip("No recently-played games available to validate fields")
        for game in data:
            assert "id" in game, f"Missing 'id' in {game}"
            assert "title" in game, f"Missing 'title' in {game}"
            assert "category" in game, f"Missing 'category' in {game}"
            assert isinstance(game["id"], str) and len(game["id"]) > 0
            assert isinstance(game["title"], str) and len(game["title"]) > 0
        print(f"PASS: All {len(data)} games have required fields (id, title, category)")

    def test_recently_played_respects_limit_param(self, admin_headers):
        """limit=2 should return at most 2 games"""
        resp = requests.get(
            f"{BASE_URL}/api/games/recently-played?limit=2",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) <= 2, (
            f"Expected at most 2 games with limit=2, got {len(data)}"
        )
        print(f"PASS: limit=2 returns {len(data)} game(s) (≤ 2)")

    def test_recently_played_default_limit_is_5(self, admin_headers):
        """Default limit should be 5 (or however many played, up to 5)"""
        resp = requests.get(
            f"{BASE_URL}/api/games/recently-played",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) <= 5, (
            f"Default limit=5 returned {len(data)} items which is > 5"
        )
        print(f"PASS: Default limit returns {len(data)} game(s) (≤ 5)")

    def test_recently_played_titles_logged(self, admin_headers):
        """Print returned game titles for manual verification of seeded games"""
        resp = requests.get(
            f"{BASE_URL}/api/games/recently-played",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        titles = [g["title"] for g in data]
        print(f"Recently-played game titles: {titles}")
        # Verify expected seeded games appear (partial title match)
        expected_partials = ["Easter", "Plane", "rich"]
        found_any = any(
            any(p.lower() in t.lower() for p in expected_partials)
            for t in titles
        )
        assert found_any, (
            f"None of the expected seeded games found in titles: {titles}"
        )
        print(f"PASS: At least one seeded game found in recently-played: {titles}")

    def test_recently_played_games_are_unique(self, admin_headers):
        """Should not return duplicate game IDs"""
        resp = requests.get(
            f"{BASE_URL}/api/games/recently-played",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        ids = [g["id"] for g in data]
        assert len(ids) == len(set(ids)), f"Duplicate game IDs in response: {ids}"
        print(f"PASS: No duplicate game IDs in {len(ids)} results")


# ---- Tests: Endpoint ordering (wildcard not swallowing) ----

class TestRecentlyPlayedRouteOrder:
    """Verify the /recently-played path is not swallowed by /games/{game_id} wildcard"""

    def test_recently_played_not_treated_as_game_id(self, admin_headers):
        """
        If /recently-played is placed after /games/{game_id}, FastAPI would match
        'recently-played' as a game_id, try DB lookup, return 404.
        A 401/403 confirms correct route ordering (auth intercepted before wildcard lookup).
        """
        # Without auth → 401/403 (not 404 from DB lookup)
        resp = requests.get(f"{BASE_URL}/api/games/recently-played")
        assert resp.status_code in (401, 403), (
            f"Expected 401/403 (route resolved correctly to auth check), got {resp.status_code} "
            f"(if 404 it means /games/{{game_id}} is catching this path — critical route ordering bug)"
        )
        print(f"PASS: /games/recently-played resolves to auth check ({resp.status_code}), not game_id wildcard")


if __name__ == "__main__":
    import sys
    sys.exit(pytest.main([__file__, "-v", "--tb=short"]))
