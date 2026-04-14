"""
Backend tests for GMZ Walkthrough Video Ads feature:
- GET /api/settings returns gmz_video_ads_enabled
- POST /api/admin/settings saves gmz_video_ads_enabled
- Admin login works
- GET /api/games/{id} returns source and embed_url for GMZ games
"""

import pytest
import requests
import os
from backend.tests.helpers import ADMIN_EMAIL, ADMIN_PASSWORD, BASE_URL


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    res = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    if res.status_code == 200:
        data = res.json()
        token = data.get("token") or data.get("access_token")
        return token
    pytest.skip(f"Admin login failed with status {res.status_code}")


@pytest.fixture(scope="module")
def gmz_game_id():
    """Get a GMZ game id for testing using admin endpoint"""
    admin_res = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    if admin_res.status_code != 200:
        pytest.skip("Admin login failed")
    token = admin_res.json().get("token") or admin_res.json().get("access_token")
    res = requests.get(
        f"{BASE_URL}/api/admin/games",
        headers={"Authorization": f"Bearer {token}"},
    )
    if res.status_code != 200:
        pytest.skip("Could not fetch admin games list")
    games = res.json()
    for game in games:
        if game.get("source") == "gamemonetize" and game.get("embed_url"):
            return game["id"]
    pytest.skip("No GMZ game found in admin games list")


class TestAdminLogin:
    """Admin login verification"""

    def test_admin_login_success(self):
        """Admin login with correct credentials returns 200 and token"""
        res = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        token = data.get("token") or data.get("access_token")
        assert token is not None, "No token in login response"
        assert isinstance(token, str) and len(token) > 0, "Token should be non-empty string"
        print(f"PASS: Admin login succeeded, token length={len(token)}")

    def test_admin_login_invalid_credentials(self):
        """Login with wrong password returns 401"""
        res = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": "wrongpassword"},
        )
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        print("PASS: Invalid credentials correctly returns 401")


class TestSettingsEndpoints:
    """Settings GET and POST endpoints"""

    def test_get_settings_returns_200(self):
        """GET /api/settings returns 200"""
        res = requests.get(f"{BASE_URL}/api/settings")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        print("PASS: GET /api/settings returns 200")

    def test_get_settings_returns_dict(self):
        """GET /api/settings returns a dict"""
        res = requests.get(f"{BASE_URL}/api/settings")
        data = res.json()
        assert isinstance(data, dict), f"Expected dict, got {type(data)}"
        print(f"PASS: GET /api/settings returns dict with keys: {list(data.keys())}")

    def test_get_settings_has_gmz_video_ads_key(self):
        """GET /api/settings response includes gmz_video_ads_enabled key after being set"""
        # First set it so the key exists
        admin_res = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        if admin_res.status_code != 200:
            pytest.skip("Admin login failed")
        token = admin_res.json().get("token") or admin_res.json().get("access_token")

        # Set the key
        set_res = requests.post(
            f"{BASE_URL}/api/admin/settings",
            json={"gmz_video_ads_enabled": "true"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert set_res.status_code == 200, f"Setting failed: {set_res.text}"

        # Now GET settings should have the key
        res = requests.get(f"{BASE_URL}/api/settings")
        data = res.json()
        assert "gmz_video_ads_enabled" in data, (
            f"gmz_video_ads_enabled missing from settings. Keys present: {list(data.keys())}"
        )
        print(f"PASS: gmz_video_ads_enabled is in settings: {data.get('gmz_video_ads_enabled')}")

    def test_post_admin_settings_requires_auth(self):
        """POST /api/admin/settings without auth returns 401 or 403"""
        res = requests.post(
            f"{BASE_URL}/api/admin/settings",
            json={"gmz_video_ads_enabled": "true"},
        )
        assert res.status_code in (401, 403), f"Expected 401/403 without auth, got {res.status_code}"
        print(f"PASS: POST /api/admin/settings without auth returns {res.status_code}")

    def test_post_admin_settings_enable_ads(self, admin_token):
        """POST /api/admin/settings with gmz_video_ads_enabled=true succeeds"""
        res = requests.post(
            f"{BASE_URL}/api/admin/settings",
            json={"gmz_video_ads_enabled": "true"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert data.get("success") is True, f"Expected success=True, got: {data}"
        print("PASS: POST /api/admin/settings (enable ads) returned success=True")

    def test_post_admin_settings_disable_ads(self, admin_token):
        """POST /api/admin/settings with gmz_video_ads_enabled=false succeeds"""
        res = requests.post(
            f"{BASE_URL}/api/admin/settings",
            json={"gmz_video_ads_enabled": "false"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert data.get("success") is True, f"Expected success=True, got: {data}"
        print("PASS: POST /api/admin/settings (disable ads) returned success=True")

    def test_gmz_video_ads_persisted_as_false(self, admin_token):
        """After disabling ads, GET /api/settings returns gmz_video_ads_enabled=false"""
        # Disable
        requests.post(
            f"{BASE_URL}/api/admin/settings",
            json={"gmz_video_ads_enabled": "false"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        # Check
        res = requests.get(f"{BASE_URL}/api/settings")
        data = res.json()
        assert data.get("gmz_video_ads_enabled") == "false", (
            f"Expected 'false', got: {data.get('gmz_video_ads_enabled')}"
        )
        print("PASS: gmz_video_ads_enabled persisted as 'false'")

    def test_gmz_video_ads_persisted_as_true(self, admin_token):
        """After enabling ads, GET /api/settings returns gmz_video_ads_enabled=true"""
        # Enable
        requests.post(
            f"{BASE_URL}/api/admin/settings",
            json={"gmz_video_ads_enabled": "true"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        # Check
        res = requests.get(f"{BASE_URL}/api/settings")
        data = res.json()
        assert data.get("gmz_video_ads_enabled") == "true", (
            f"Expected 'true', got: {data.get('gmz_video_ads_enabled')}"
        )
        print("PASS: gmz_video_ads_enabled persisted as 'true'")


class TestGMZGameDetails:
    """Game details endpoint returns source and embed_url for GMZ games"""

    def test_get_games_list(self):
        """GET /api/games returns list with games"""
        res = requests.get(f"{BASE_URL}/api/games?limit=10")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        data = res.json()
        if isinstance(data, dict):
            games = data.get("games", [])
        else:
            games = data
        assert len(games) > 0, "No games returned"
        print(f"PASS: GET /api/games returned {len(games)} games")

    def test_gmz_game_has_source_and_embed_url(self, gmz_game_id):
        """GET /api/games/{id} for a GMZ game returns source=gamemonetize and embed_url"""
        res = requests.get(f"{BASE_URL}/api/games/{gmz_game_id}")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        game = res.json()
        assert game.get("source") == "gamemonetize", (
            f"Expected source=gamemonetize, got: {game.get('source')}"
        )
        assert game.get("embed_url"), "embed_url should be non-empty for GMZ games"
        print(f"PASS: GMZ game has source={game['source']}, embed_url={game.get('embed_url', '')[:60]}")

    def test_gmz_embed_url_has_hash(self, gmz_game_id):
        """The embed_url of a GMZ game contains a hash segment"""
        res = requests.get(f"{BASE_URL}/api/games/{gmz_game_id}")
        game = res.json()
        embed_url = game.get("embed_url", "")
        hash_part = embed_url.replace("/", "").split("/")[-1] if "/" in embed_url else embed_url
        # Extract last path segment
        parts = embed_url.rstrip("/").split("/")
        last_segment = parts[-1] if parts else ""
        assert last_segment, f"Could not extract hash from embed_url: {embed_url}"
        print(f"PASS: GMZ embed_url hash segment: {last_segment}")
