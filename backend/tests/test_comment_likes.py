"""
Backend tests for Comment Like feature
Tests: POST/DELETE /api/games/{game_id}/comments/{comment_id}/like
       GET /api/games/{game_id}/comments includes like_count and liked_by_me
"""

import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://instant-play-69.preview.emergentagent.com"

ADMIN_EMAIL = "admin@hypd.games"
ADMIN_PASSWORD = "admin123"


# ─── Fixtures ───────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def admin_token():
    """Login as admin, return bearer token."""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    token = resp.json().get("access_token")
    assert token, "No access_token returned"
    return token


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def first_game_id(admin_headers):
    """Get the first visible game_id from the feed."""
    resp = requests.get(f"{BASE_URL}/api/games")
    assert resp.status_code == 200
    games = resp.json()
    assert len(games) > 0, "No games found in feed"
    return games[0]["id"]


@pytest.fixture(scope="module")
def test_comment(first_game_id, admin_headers):
    """Create a fresh comment for testing likes; delete after module completes."""
    resp = requests.post(
        f"{BASE_URL}/api/games/{first_game_id}/comments",
        json={"content": "TEST_like_feature_comment"},
        headers=admin_headers,
    )
    assert resp.status_code == 200, f"Comment creation failed: {resp.text}"
    comment = resp.json()
    yield first_game_id, comment["id"]

    # Teardown: delete the comment
    requests.delete(
        f"{BASE_URL}/api/games/{first_game_id}/comments/{comment['id']}",
        headers=admin_headers,
    )


# ─── Tests ──────────────────────────────────────────────────────────────────

class TestGetCommentsFields:
    """Verify GET /api/games/{game_id}/comments returns like_count and liked_by_me."""

    def test_get_comments_returns_like_fields_unauthenticated(self, first_game_id):
        """Without auth, comments should still have like_count=0 and liked_by_me=False."""
        resp = requests.get(f"{BASE_URL}/api/games/{first_game_id}/comments")
        assert resp.status_code == 200, f"GET comments failed: {resp.text}"
        data = resp.json()
        assert "comments" in data
        # Even if empty, ensure response structure is correct
        for c in data["comments"]:
            assert "like_count" in c, f"Missing like_count in comment: {c}"
            assert "liked_by_me" in c, f"Missing liked_by_me in comment: {c}"

    def test_get_comments_returns_like_fields_authenticated(self, first_game_id, admin_headers):
        """With admin auth, liked_by_me should reflect actual like state."""
        resp = requests.get(
            f"{BASE_URL}/api/games/{first_game_id}/comments",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        for c in data["comments"]:
            assert "like_count" in c
            assert "liked_by_me" in c
            assert isinstance(c["like_count"], int)
            assert isinstance(c["liked_by_me"], bool)


class TestLikeCommentAPI:
    """POST /api/games/{game_id}/comments/{comment_id}/like"""

    def test_like_requires_auth(self, test_comment):
        """Like without token should return 403 (HTTPBearer raises 403 when no header)."""
        game_id, comment_id = test_comment
        resp = requests.post(f"{BASE_URL}/api/games/{game_id}/comments/{comment_id}/like")
        assert resp.status_code in (401, 403), f"Expected 401/403 but got {resp.status_code}"

    def test_like_comment_returns_liked_true(self, test_comment, admin_headers):
        """POST like returns {liked: true}."""
        game_id, comment_id = test_comment
        resp = requests.post(
            f"{BASE_URL}/api/games/{game_id}/comments/{comment_id}/like",
            headers=admin_headers,
        )
        assert resp.status_code == 200, f"Like failed: {resp.text}"
        data = resp.json()
        assert data.get("liked") is True, f"Expected liked=True but got: {data}"

    def test_like_is_idempotent(self, test_comment, admin_headers):
        """Calling like twice should still return liked=True without error."""
        game_id, comment_id = test_comment
        resp = requests.post(
            f"{BASE_URL}/api/games/{game_id}/comments/{comment_id}/like",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json().get("liked") is True

    def test_like_reflected_in_get_comments(self, test_comment, admin_headers):
        """After liking, GET /comments should show like_count>=1 and liked_by_me=True."""
        game_id, comment_id = test_comment
        resp = requests.get(
            f"{BASE_URL}/api/games/{game_id}/comments",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        comments = resp.json()["comments"]
        target = next((c for c in comments if c["id"] == comment_id), None)
        assert target is not None, "Liked comment not found in GET response"
        assert target["liked_by_me"] is True, f"liked_by_me not True after like: {target}"
        assert target["like_count"] >= 1, f"like_count should be >=1 after like: {target}"

    def test_like_count_increments(self, test_comment, admin_headers, first_game_id):
        """Verify like_count is exactly 1 for a fresh comment."""
        game_id, comment_id = test_comment
        resp = requests.get(
            f"{BASE_URL}/api/games/{game_id}/comments",
            headers=admin_headers,
        )
        comments = resp.json()["comments"]
        target = next((c for c in comments if c["id"] == comment_id), None)
        assert target is not None
        assert target["like_count"] == 1, f"Expected like_count=1 but got: {target['like_count']}"

    def test_like_404_for_nonexistent_comment(self, first_game_id, admin_headers):
        """Like on a non-existent comment should 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = requests.post(
            f"{BASE_URL}/api/games/{first_game_id}/comments/{fake_id}/like",
            headers=admin_headers,
        )
        assert resp.status_code == 404, f"Expected 404 but got {resp.status_code}"


class TestUnlikeCommentAPI:
    """DELETE /api/games/{game_id}/comments/{comment_id}/like"""

    def test_unlike_comment_returns_liked_false(self, test_comment, admin_headers):
        """DELETE like returns {liked: false}."""
        game_id, comment_id = test_comment
        resp = requests.delete(
            f"{BASE_URL}/api/games/{game_id}/comments/{comment_id}/like",
            headers=admin_headers,
        )
        assert resp.status_code == 200, f"Unlike failed: {resp.text}"
        data = resp.json()
        assert data.get("liked") is False, f"Expected liked=False but got: {data}"

    def test_unlike_reflected_in_get_comments(self, test_comment, admin_headers):
        """After unliking, GET /comments should show liked_by_me=False and like_count=0."""
        game_id, comment_id = test_comment
        resp = requests.get(
            f"{BASE_URL}/api/games/{game_id}/comments",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        comments = resp.json()["comments"]
        target = next((c for c in comments if c["id"] == comment_id), None)
        assert target is not None, "Comment not found after unlike"
        assert target["liked_by_me"] is False, f"liked_by_me should be False after unlike: {target}"
        assert target["like_count"] == 0, f"like_count should be 0 after unlike: {target}"

    def test_unlike_is_idempotent(self, test_comment, admin_headers):
        """Calling unlike twice should not raise an error."""
        game_id, comment_id = test_comment
        resp = requests.delete(
            f"{BASE_URL}/api/games/{game_id}/comments/{comment_id}/like",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json().get("liked") is False


class TestNewCommentLikeCount:
    """New comments should start with 0 likes."""

    def test_new_comment_starts_with_zero_likes(self, first_game_id, admin_headers):
        """Post a new comment, verify like_count=0 and liked_by_me=False."""
        # Post new comment
        post_resp = requests.post(
            f"{BASE_URL}/api/games/{first_game_id}/comments",
            json={"content": "TEST_new_comment_zero_likes"},
            headers=admin_headers,
        )
        assert post_resp.status_code == 200
        new_comment_id = post_resp.json()["id"]

        try:
            # Fetch comments to verify like_count and liked_by_me
            get_resp = requests.get(
                f"{BASE_URL}/api/games/{first_game_id}/comments",
                headers=admin_headers,
            )
            assert get_resp.status_code == 200
            comments = get_resp.json()["comments"]
            target = next((c for c in comments if c["id"] == new_comment_id), None)
            assert target is not None, "Newly created comment not found"
            assert target["like_count"] == 0, f"New comment should have like_count=0: {target}"
            assert target["liked_by_me"] is False, f"New comment liked_by_me should be False: {target}"
        finally:
            # Teardown
            requests.delete(
                f"{BASE_URL}/api/games/{first_game_id}/comments/{new_comment_id}",
                headers=admin_headers,
            )
