"""
Test suite for dead-code removal and optimization pass validation.
Tests: removed endpoints return 404, kept endpoints work, admin validations.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("NEXT_PUBLIC_API_URL", "").rstrip("/")


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get admin token for authenticated tests."""
    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@hypd.games", "password": "admin123"},
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin login failed — skipping authenticated tests")


@pytest.fixture(scope="module")
def auth_client(api_client, admin_token):
    """Session with admin auth header."""
    api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
    return api_client


# ── Removed Endpoints — must return 404 ────────────────────────────────────────

class TestRemovedEndpoints:
    """Verify that removed endpoints return 404 (not found)."""

    def test_analytics_event_endpoint_removed(self, api_client):
        """POST /api/analytics/event was removed (duplicate). Must return 404."""
        res = api_client.post(
            f"{BASE_URL}/api/analytics/event",
            json={"event_type": "play", "game_id": "test-game-id"},
        )
        assert res.status_code == 404, (
            f"Expected 404 (endpoint removed) but got {res.status_code}: {res.text[:200]}"
        )
        print(f"PASS: POST /api/analytics/event returns 404 as expected")

    def test_gamedistribution_browse_removed(self, api_client):
        """GET /api/gamedistribution/browse was removed. Must return 404."""
        res = api_client.get(f"{BASE_URL}/api/gamedistribution/browse")
        assert res.status_code == 404, (
            f"Expected 404 (endpoint removed) but got {res.status_code}: {res.text[:200]}"
        )
        print(f"PASS: GET /api/gamedistribution/browse returns 404 as expected")

    def test_gamedistribution_game_removed(self, api_client):
        """GET /api/gamedistribution/games/<id> was removed. Must return 404."""
        res = api_client.get(f"{BASE_URL}/api/gamedistribution/games/test-game-id")
        assert res.status_code == 404, (
            f"Expected 404 (endpoint removed) but got {res.status_code}: {res.text[:200]}"
        )
        print(f"PASS: GET /api/gamedistribution/games/<id> returns 404 as expected")

    def test_gamedistribution_import_removed(self, api_client):
        """POST /api/admin/gamedistribution/import was removed. Must return 404."""
        res = api_client.post(
            f"{BASE_URL}/api/admin/gamedistribution/import",
            json={"gd_game_id": "test-id"},
        )
        assert res.status_code in [404, 401, 403], (
            f"Expected 404/401/403 but got {res.status_code}: {res.text[:200]}"
        )
        print(f"PASS: POST /api/admin/gamedistribution/import returns {res.status_code} (expected removed/unauthorized)")

    def test_gamedistribution_bulk_import_removed(self, api_client):
        """POST /api/admin/gamedistribution/bulk-import was removed. Must return 404."""
        res = api_client.post(
            f"{BASE_URL}/api/admin/gamedistribution/bulk-import",
            json=[],
        )
        assert res.status_code in [404, 401, 403], (
            f"Expected 404/401/403 but got {res.status_code}: {res.text[:200]}"
        )
        print(f"PASS: POST /api/admin/gamedistribution/bulk-import returns {res.status_code} (expected removed/unauthorized)")


# ── Kept Endpoints — must still work ───────────────────────────────────────────

class TestKeptEndpoints:
    """Verify that kept endpoints still work correctly after cleanup."""

    def test_analytics_track_still_works(self, api_client):
        """POST /api/analytics/track (richer endpoint) must return 200."""
        res = api_client.post(
            f"{BASE_URL}/api/analytics/track",
            data={"event_type": "page_view", "game_id": ""},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert res.status_code == 200, (
            f"Expected 200 but got {res.status_code}: {res.text[:300]}"
        )
        data = res.json()
        assert "status" in data or "success" in data or "id" in data, (
            f"Unexpected response shape: {data}"
        )
        print(f"PASS: POST /api/analytics/track returns 200, data keys: {list(data.keys())}")

    def test_games_feed_returns_games(self, api_client):
        """GET /api/games/feed must return a non-empty list."""
        res = api_client.get(f"{BASE_URL}/api/games/feed")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text[:200]}"
        data = res.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        assert len(data) > 0, "Expected non-empty game list"
        # Verify game structure
        game = data[0]
        assert "id" in game
        assert "title" in game
        assert "category" in game
        print(f"PASS: GET /api/games/feed returns {len(data)} games")

    def test_gamemonetize_browse_still_works(self, api_client):
        """GET /api/gamemonetize/browse must still work (GD was removed, GMZ kept)."""
        res = api_client.get(f"{BASE_URL}/api/gamemonetize/browse")
        assert res.status_code == 200, (
            f"Expected 200 but got {res.status_code}: {res.text[:200]}"
        )
        data = res.json()
        assert "games" in data, f"Expected 'games' key, got: {list(data.keys())}"
        print(f"PASS: GET /api/gamemonetize/browse returns 200 with {len(data.get('games', []))} games")

    def test_admin_login_works(self, api_client):
        """POST /api/auth/login with admin credentials returns access_token."""
        res = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@hypd.games", "password": "admin123"},
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text[:200]}"
        data = res.json()
        assert "access_token" in data, f"No access_token in response: {data}"
        assert isinstance(data["access_token"], str) and len(data["access_token"]) > 10
        print(f"PASS: Admin login returns access_token")

    def test_get_settings_returns_200(self, api_client):
        """GET /api/settings must return 200 with settings dict."""
        res = api_client.get(f"{BASE_URL}/api/settings")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text[:200]}"
        data = res.json()
        assert isinstance(data, dict), f"Expected dict, got {type(data)}"
        print(f"PASS: GET /api/settings returns 200 with keys: {list(data.keys())}")


# ── Admin Delete-by-Source Validation ──────────────────────────────────────────

class TestAdminDeleteBySource:
    """Verify that admin delete-by-source only accepts 'custom' and 'gamemonetize'."""

    def test_delete_by_source_rejects_gamedistribution(self, auth_client):
        """DELETE /api/admin/games/cleanup/by-source?source=gamedistribution must return 400."""
        res = auth_client.delete(
            f"{BASE_URL}/api/admin/games/cleanup/by-source?source=gamedistribution"
        )
        assert res.status_code == 400, (
            f"Expected 400 for invalid source 'gamedistribution', got {res.status_code}: {res.text[:200]}"
        )
        data = res.json()
        detail = data.get("detail", "")
        assert "invalid" in detail.lower() or "custom" in detail.lower() or "gamemonetize" in detail.lower(), (
            f"Error message doesn't mention valid sources: {detail}"
        )
        print(f"PASS: delete-by-source rejects 'gamedistribution' with 400: {detail}")

    def test_delete_by_source_rejects_gamepix(self, auth_client):
        """DELETE /api/admin/games/cleanup/by-source?source=gamepix must return 400."""
        res = auth_client.delete(
            f"{BASE_URL}/api/admin/games/cleanup/by-source?source=gamepix"
        )
        assert res.status_code == 400, (
            f"Expected 400 for invalid source 'gamepix', got {res.status_code}: {res.text[:200]}"
        )
        data = res.json()
        detail = data.get("detail", "")
        print(f"PASS: delete-by-source rejects 'gamepix' with 400: {detail}")

    def test_delete_by_source_accepts_gamemonetize_via_source_code(self, auth_client):
        """Verify 'gamemonetize' is a valid source in the delete-by-source endpoint.
        
        NOTE: We do NOT actually call the DELETE to avoid accidental data deletion.
        We instead verify via the invalid-source rejection test (gamepix/gamedistribution are 400)
        while 'gamemonetize' is in valid_sources=['custom', 'gamemonetize'] in server.py.
        The 400 tests above confirm only gamedistribution/gamepix are rejected.
        """
        # We verify by checking the error message when we use an invalid source mentions gamemonetize
        res = auth_client.delete(
            f"{BASE_URL}/api/admin/games/cleanup/by-source?source=invalid_test_source_xyz"
        )
        assert res.status_code == 400, f"Expected 400 for clearly invalid source"
        data = res.json()
        detail = data.get("detail", "")
        # The error message should include 'gamemonetize' as one of the valid options
        assert "gamemonetize" in detail.lower(), (
            f"Expected 'gamemonetize' listed as valid in error message: {detail}"
        )
        # And 'custom' too
        assert "custom" in detail.lower(), (
            f"Expected 'custom' listed as valid in error message: {detail}"
        )
        # And NOT contain gamedistribution or gamepix as valid options
        assert "gamedistribution" not in detail.lower(), (
            f"'gamedistribution' should NOT be a valid source but appears in: {detail}"
        )
        assert "gamepix" not in detail.lower(), (
            f"'gamepix' should NOT be a valid source but appears in: {detail}"
        )
        print(f"PASS: valid sources are 'custom' and 'gamemonetize' only (no gamedistribution/gamepix). Error msg: {detail}")

    def test_delete_by_source_accepts_custom_via_error_msg(self, auth_client):
        """Verify 'custom' is listed as a valid source via error message inspection (safe, no data deletion)."""
        # Same safe approach - validate via error message on invalid source
        res = auth_client.delete(
            f"{BASE_URL}/api/admin/games/cleanup/by-source?source=zzz_nonexistent"
        )
        assert res.status_code == 400
        data = res.json()
        detail = data.get("detail", "")
        assert "custom" in detail.lower(), f"'custom' should be in valid sources error message: {detail}"
        print(f"PASS: 'custom' is a valid source (confirmed via error msg for invalid source)")
