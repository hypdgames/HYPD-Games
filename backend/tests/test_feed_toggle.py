"""
Test suite for feed toggle feature:
- Admin feed visibility toggle (show_in_feed)
- GET /api/games filters by show_in_feed
- PATCH /api/admin/games/{id}/feed-visibility endpoint
- Eye/EyeOff visibility toggle still works
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin JWT token"""
    res = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@hypd.games", "password": "admin123"},
    )
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    return res.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def cat_evolution_id():
    """Get Cat Evolution game ID from feed"""
    res = requests.get(f"{BASE_URL}/api/games")
    assert res.status_code == 200
    games = res.json()
    # Find Cat Evolution
    cat = next((g for g in games if "cat evolution" in g["title"].lower()), None)
    if cat is None:
        # Try admin games list
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@hypd.games", "password": "admin123"},
        )
        token = r.json()["access_token"]
        admin_res = requests.get(
            f"{BASE_URL}/api/admin/games",
            headers={"Authorization": f"Bearer {token}"},
        )
        games = admin_res.json()
        cat = next((g for g in games if "cat evolution" in g["title"].lower()), None)
    assert cat is not None, "Cat Evolution game not found in DB"
    return cat["id"]


class TestFeedToggleAPI:
    """Tests for PATCH /api/admin/games/{id}/feed-visibility"""

    def test_get_games_returns_feed_only_by_default(self, cat_evolution_id):
        """GET /api/games should return only show_in_feed=True games"""
        res = requests.get(f"{BASE_URL}/api/games")
        assert res.status_code == 200
        games = res.json()
        # Verify all returned games have show_in_feed=True (not explicitly false)
        for g in games:
            assert g.get("show_in_feed") is not False, (
                f"Game {g['title']} has show_in_feed=False but appears in feed"
            )
        print(f"PASS: GET /api/games returned {len(games)} feed games, all show_in_feed=True")

    def test_cat_evolution_initially_in_feed(self, cat_evolution_id):
        """Cat Evolution should initially be in feed"""
        res = requests.get(f"{BASE_URL}/api/games")
        assert res.status_code == 200
        games = res.json()
        ids = [g["id"] for g in games]
        assert cat_evolution_id in ids, "Cat Evolution should be in the feed initially"
        print("PASS: Cat Evolution is in feed initially")

    def test_remove_cat_evolution_from_feed(self, cat_evolution_id, auth_headers):
        """PATCH feed-visibility with show_in_feed=false should remove from feed"""
        res = requests.patch(
            f"{BASE_URL}/api/admin/games/{cat_evolution_id}/feed-visibility",
            headers=auth_headers,
            json={"show_in_feed": False},
        )
        assert res.status_code == 200, f"Feed toggle failed: {res.text}"
        data = res.json()
        assert data.get("success") is True
        assert data.get("show_in_feed") is False
        print("PASS: PATCH feed-visibility set show_in_feed=False")

    def test_get_games_returns_empty_after_remove_from_feed(self, cat_evolution_id, auth_headers):
        """After removing Cat Evolution from feed, GET /api/games should return 0 games"""
        # Ensure removed from feed first
        requests.patch(
            f"{BASE_URL}/api/admin/games/{cat_evolution_id}/feed-visibility",
            headers=auth_headers,
            json={"show_in_feed": False},
        )
        res = requests.get(f"{BASE_URL}/api/games")
        assert res.status_code == 200
        games = res.json()
        assert len(games) == 0, (
            f"Expected 0 feed games after removing Cat Evolution, got {len(games)}"
        )
        print("PASS: GET /api/games returns 0 games after Cat Evolution removed from feed")

    def test_add_cat_evolution_back_to_feed(self, cat_evolution_id, auth_headers):
        """PATCH feed-visibility with show_in_feed=true should add back to feed"""
        res = requests.patch(
            f"{BASE_URL}/api/admin/games/{cat_evolution_id}/feed-visibility",
            headers=auth_headers,
            json={"show_in_feed": True},
        )
        assert res.status_code == 200, f"Feed toggle restore failed: {res.text}"
        data = res.json()
        assert data.get("success") is True
        assert data.get("show_in_feed") is True
        print("PASS: PATCH feed-visibility set show_in_feed=True (restored)")

    def test_get_games_returns_game_after_restore(self, cat_evolution_id, auth_headers):
        """After re-adding Cat Evolution to feed, GET /api/games returns it again"""
        # Ensure in feed
        requests.patch(
            f"{BASE_URL}/api/admin/games/{cat_evolution_id}/feed-visibility",
            headers=auth_headers,
            json={"show_in_feed": True},
        )
        res = requests.get(f"{BASE_URL}/api/games")
        assert res.status_code == 200
        games = res.json()
        ids = [g["id"] for g in games]
        assert cat_evolution_id in ids, "Cat Evolution should be back in feed"
        print("PASS: Cat Evolution is back in feed after restore")

    def test_feed_toggle_requires_admin_auth(self, cat_evolution_id):
        """Feed toggle should return 401/403 without auth"""
        res = requests.patch(
            f"{BASE_URL}/api/admin/games/{cat_evolution_id}/feed-visibility",
            json={"show_in_feed": False},
        )
        assert res.status_code in (401, 403), (
            f"Expected 401/403 without auth, got {res.status_code}"
        )
        print(f"PASS: Feed toggle returns {res.status_code} without auth")

    def test_feed_toggle_invalid_game_returns_404(self, auth_headers):
        """Feed toggle with invalid game ID should return 404"""
        res = requests.patch(
            f"{BASE_URL}/api/admin/games/invalid-game-id-xyz/feed-visibility",
            headers=auth_headers,
            json={"show_in_feed": False},
        )
        assert res.status_code == 404, f"Expected 404 for invalid game, got {res.status_code}"
        print("PASS: Feed toggle returns 404 for non-existent game")


class TestVisibilityToggle:
    """Tests for existing Eye/EyeOff visibility toggle (is_visible)"""

    def test_hide_game_visibility(self, cat_evolution_id, auth_headers):
        """PATCH visibility to is_visible=false should hide game"""
        res = requests.patch(
            f"{BASE_URL}/api/admin/games/{cat_evolution_id}/visibility",
            headers=auth_headers,
            json={"is_visible": False},
        )
        assert res.status_code == 200, f"Visibility toggle failed: {res.text}"
        data = res.json()
        assert data.get("success") is True
        print("PASS: PATCH visibility set is_visible=False")

    def test_hidden_game_not_in_feed(self, cat_evolution_id, auth_headers):
        """Hidden game (is_visible=False) should not appear in GET /api/games"""
        requests.patch(
            f"{BASE_URL}/api/admin/games/{cat_evolution_id}/visibility",
            headers=auth_headers,
            json={"is_visible": False},
        )
        res = requests.get(f"{BASE_URL}/api/games")
        assert res.status_code == 200
        games = res.json()
        ids = [g["id"] for g in games]
        assert cat_evolution_id not in ids, "Hidden game should not appear in feed"
        print("PASS: Hidden game excluded from GET /api/games")

    def test_restore_game_visibility(self, cat_evolution_id, auth_headers):
        """Restore is_visible=True so other tests work"""
        res = requests.patch(
            f"{BASE_URL}/api/admin/games/{cat_evolution_id}/visibility",
            headers=auth_headers,
            json={"is_visible": True},
        )
        assert res.status_code == 200
        print("PASS: Game visibility restored to True")

    def test_game_back_in_feed_after_visibility_restore(self, cat_evolution_id, auth_headers):
        """After restoring visibility, game should be in feed again"""
        requests.patch(
            f"{BASE_URL}/api/admin/games/{cat_evolution_id}/visibility",
            headers=auth_headers,
            json={"is_visible": True},
        )
        res = requests.get(f"{BASE_URL}/api/games")
        assert res.status_code == 200
        games = res.json()
        ids = [g["id"] for g in games]
        assert cat_evolution_id in ids, "Restored game should appear in feed"
        print("PASS: Restored game appears in GET /api/games")
