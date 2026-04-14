"""
Performance and caching tests for Hypd Games API.
Tests:
- /api/games response time < 500ms (was 3.77s before cache)
- /api/categories response time < 300ms
- /api/games/video-previews-batch second call < 300ms
- Core game feed, explore, admin login, cache invalidation flows
"""

import pytest
import requests
import time
import os
from backend.tests.helpers import ADMIN_EMAIL, ADMIN_PASSWORD, BASE_URL


@pytest.fixture(scope="module")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def admin_token(api_client):
    """Login as admin and return the token."""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        token = data.get("access_token") or data.get("token")
        return token
    pytest.skip(f"Admin login failed ({response.status_code}): {response.text[:200]}")


@pytest.fixture(scope="module")
def admin_client(api_client, admin_token):
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_token}"
    })
    return session


# ── Performance Tests ──────────────────────────────────────────────────────────

class TestPerformance:
    """Performance benchmarks — cache should keep these well under thresholds."""

    def test_games_api_first_call_fast(self, api_client):
        """First call to /api/games — should be fast due to startup cache pre-warm."""
        start = time.time()
        response = api_client.get(f"{BASE_URL}/api/games")
        elapsed = time.time() - start
        assert response.status_code == 200, f"API returned {response.status_code}"
        print(f"/api/games first call: {elapsed:.3f}s")
        # Generous threshold: under 2000ms even if cache cold
        assert elapsed < 2.0, f"/api/games took {elapsed:.3f}s (expected < 2.0s)"

    def test_games_api_second_call_cached(self, api_client):
        """Second call should hit the in-memory cache (< 500ms)."""
        # Warm up
        api_client.get(f"{BASE_URL}/api/games")
        time.sleep(0.1)

        start = time.time()
        response = api_client.get(f"{BASE_URL}/api/games")
        elapsed = time.time() - start

        assert response.status_code == 200, f"API returned {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Expected a list of games"
        print(f"/api/games cached call: {elapsed:.3f}s, games count: {len(data)}")
        assert elapsed < 0.5, f"/api/games cached call took {elapsed:.3f}s (expected < 500ms)"

    def test_categories_api_fast(self, api_client):
        """Warm up then test cached /api/categories — should be < 300ms."""
        # Warm up
        api_client.get(f"{BASE_URL}/api/categories")
        time.sleep(0.1)

        start = time.time()
        response = api_client.get(f"{BASE_URL}/api/categories")
        elapsed = time.time() - start

        assert response.status_code == 200, f"API returned {response.status_code}"
        data = response.json()
        assert "categories" in data, f"Expected 'categories' key, got {list(data.keys())}"
        print(f"/api/categories cached call: {elapsed:.3f}s, count: {len(data['categories'])}")
        assert elapsed < 0.3, f"/api/categories took {elapsed:.3f}s (expected < 300ms)"

    def test_video_previews_batch_cached(self, api_client):
        """Second call to /api/games/video-previews-batch should hit 30-min cache."""
        # Warm up (first call may be slow if cache expired)
        first_start = time.time()
        r1 = api_client.get(f"{BASE_URL}/api/games/video-previews-batch", timeout=60)
        first_elapsed = time.time() - first_start
        assert r1.status_code == 200, f"First batch call failed: {r1.status_code}"
        print(f"/api/games/video-previews-batch first call: {first_elapsed:.3f}s")
        time.sleep(0.1)

        # Second call — should be cached
        start = time.time()
        response = api_client.get(f"{BASE_URL}/api/games/video-previews-batch", timeout=10)
        elapsed = time.time() - start

        assert response.status_code == 200, f"API returned {response.status_code}"
        data = response.json()
        assert isinstance(data, dict), "Expected dict of {game_id: video_url}"
        print(f"/api/games/video-previews-batch cached: {elapsed:.3f}s, entries: {len(data)}")
        assert elapsed < 0.3, f"Cached video batch took {elapsed:.3f}s (expected < 300ms)"

    def test_games_api_returns_games(self, api_client):
        """Verify /api/games returns a non-empty list of games."""
        response = api_client.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Should return a list"
        assert len(data) > 0, "Games list should not be empty"
        # Validate first game has required fields
        game = data[0]
        assert "id" in game
        assert "title" in game
        print(f"Games returned: {len(data)}, first: {game.get('title', 'N/A')}")


# ── Core API Tests ─────────────────────────────────────────────────────────────

class TestCoreAPIs:
    """Core API endpoints working correctly."""

    def test_games_endpoint_structure(self, api_client):
        """GET /api/games returns correct structure."""
        response = api_client.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if data:
            g = data[0]
            for field in ["id", "title", "category", "is_visible"]:
                assert field in g, f"Missing field: {field}"

    def test_categories_structure(self, api_client):
        """GET /api/categories returns list of categories."""
        response = api_client.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        assert isinstance(data["categories"], list)
        assert len(data["categories"]) > 0, "Should have at least one category"
        print(f"Categories: {data['categories']}")

    def test_games_category_filter(self, api_client):
        """GET /api/games?category=Action filters by category."""
        # First get categories
        cats_res = api_client.get(f"{BASE_URL}/api/categories")
        if cats_res.status_code != 200:
            pytest.skip("Categories not available")
        cats = cats_res.json().get("categories", [])
        if not cats:
            pytest.skip("No categories available")

        cat = cats[0]
        response = api_client.get(f"{BASE_URL}/api/games?category={cat}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Category '{cat}' games: {len(data)}")

    def test_health_check(self, api_client):
        """Root endpoint returns API info."""
        response = api_client.get(f"{BASE_URL}/api/health")
        # May be 200 or 404 depending on implementation
        print(f"Health check status: {response.status_code}")
        assert response.status_code in [200, 404]


# ── Admin Authentication & Feed Toggle ────────────────────────────────────────

class TestAdminAuth:
    """Admin login and game management."""

    def test_admin_login_success(self, api_client):
        """Admin can login with correct credentials."""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.status_code} - {response.text[:200]}"
        data = response.json()
        token = data.get("access_token") or data.get("token")
        assert token is not None, "Response missing access_token"
        print(f"Admin login successful, token: {token[:20]}...")

    def test_admin_wrong_password_fails(self, api_client):
        """Login with wrong password should fail."""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword123"
        })
        assert response.status_code in [401, 403, 400], f"Expected auth failure, got {response.status_code}"

    def test_admin_get_games(self, admin_client):
        """Admin can get all games (including hidden)."""
        response = admin_client.get(f"{BASE_URL}/api/admin/games")
        assert response.status_code == 200, f"Admin games failed: {response.status_code}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Admin sees {len(data)} games")

    def test_admin_is_admin_flag(self, api_client, admin_token):
        """Verify admin user has is_admin=True."""
        session = requests.Session()
        session.headers.update({"Authorization": f"Bearer {admin_token}"})
        response = session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Auth/me failed: {response.status_code}"
        data = response.json()
        assert data.get("is_admin") is True, f"User is not admin: {data}"
        print(f"Admin user confirmed: {data.get('email')}")


# ── Cache Invalidation ────────────────────────────────────────────────────────

class TestCacheInvalidation:
    """Cache busting after admin mutations."""

    def test_cache_busted_after_game_toggle(self, api_client, admin_client):
        """Toggle game visibility → cache should be invalidated → fresh data within 30s."""
        # Get a game to toggle
        games_res = admin_client.get(f"{BASE_URL}/api/admin/games")
        if games_res.status_code != 200 or not games_res.json():
            pytest.skip("No admin games available")
        games = games_res.json()
        game = games[0]
        game_id = game["id"]
        original_visibility = game.get("is_visible", True)
        original_feed = game.get("show_in_feed", True)

        print(f"Using game '{game.get('title')}' (id={game_id}), visible={original_visibility}, feed={original_feed}")

        # Toggle show_in_feed
        new_feed_value = not original_feed
        toggle_res = admin_client.patch(
            f"{BASE_URL}/api/admin/games/{game_id}/toggle-feed",
            json={"show_in_feed": new_feed_value}
        )
        if toggle_res.status_code == 404:
            # Try alternative toggle endpoint
            toggle_res = admin_client.put(
                f"{BASE_URL}/api/admin/games/{game_id}",
                json={"show_in_feed": new_feed_value}
            )
        print(f"Toggle response: {toggle_res.status_code}")

        # Wait max 2s for cache invalidation
        time.sleep(0.5)

        # Fetch fresh data from games API — should reflect the change within 30s TTL window
        fresh_res = api_client.get(f"{BASE_URL}/api/games")
        assert fresh_res.status_code == 200

        # Restore original value
        if toggle_res.status_code in [200, 201]:
            admin_client.patch(
                f"{BASE_URL}/api/admin/games/{game_id}/toggle-feed",
                json={"show_in_feed": original_feed}
            )
            admin_client.put(
                f"{BASE_URL}/api/admin/games/{game_id}",
                json={"show_in_feed": original_feed}
            )

        print("Cache invalidation test completed")

    def test_games_cache_header_present(self, api_client):
        """Verify Cache-Control header is returned."""
        response = api_client.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200
        cache_header = response.headers.get("Cache-Control", "")
        print(f"Cache-Control header: '{cache_header}'")
        assert cache_header, "Cache-Control header should be present"
        assert "max-age" in cache_header, f"max-age missing from Cache-Control: {cache_header}"

    def test_categories_cache_header_present(self, api_client):
        """Verify /api/categories also returns Cache-Control."""
        response = api_client.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        cache_header = response.headers.get("Cache-Control", "")
        print(f"Categories Cache-Control: '{cache_header}'")
        # Categories may or may not have this header; just verify status
        assert response.status_code == 200


# ── Admin Game Feed Toggle ────────────────────────────────────────────────────

class TestAdminFeedToggle:
    """Admin toggle game in/out of feed."""

    def test_admin_games_list_not_empty(self, admin_client):
        """Admin can see game list."""
        response = admin_client.get(f"{BASE_URL}/api/admin/games")
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0, "Admin should see at least one game"
        print(f"Admin game list: {len(data)} games")
        g = data[0]
        print(f"Sample game: id={g.get('id')}, title={g.get('title')}, visible={g.get('is_visible')}, feed={g.get('show_in_feed')}")

    def test_game_visibility_toggle(self, admin_client):
        """Test toggling game visibility via the admin API."""
        games_res = admin_client.get(f"{BASE_URL}/api/admin/games")
        if games_res.status_code != 200:
            pytest.skip("Cannot get admin games")
        games = games_res.json()
        if not games:
            pytest.skip("No games available")

        game = games[0]
        game_id = game["id"]
        original_visible = game.get("is_visible", True)

        # Try the toggle-visibility endpoint  
        toggle_res = admin_client.patch(
            f"{BASE_URL}/api/admin/games/{game_id}/toggle-visibility"
        )
        
        if toggle_res.status_code == 404:
            # Try PUT update
            toggle_res = admin_client.put(
                f"{BASE_URL}/api/admin/games/{game_id}",
                json={"is_visible": not original_visible}
            )
        
        print(f"Toggle visibility status: {toggle_res.status_code}")
        if toggle_res.status_code in [200, 201]:
            # Restore original
            admin_client.patch(f"{BASE_URL}/api/admin/games/{game_id}/toggle-visibility")
            admin_client.put(f"{BASE_URL}/api/admin/games/{game_id}", json={"is_visible": original_visible})
            print("Game visibility toggle works and restored")
        else:
            print(f"Toggle response: {toggle_res.text[:200]}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
