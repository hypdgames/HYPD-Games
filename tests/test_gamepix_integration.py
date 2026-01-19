"""
GamePix Integration Tests for Hypd Games
Tests the GamePix RSS feed integration endpoints:
- GET /api/gamepix/browse - Browse games from GamePix RSS feed
- GET /api/gamepix/categories - Get available GamePix categories
- POST /api/admin/gamepix/import - Import single game (admin only)
- POST /api/admin/gamepix/bulk-import - Bulk import games (admin only)
- GET /api/games - Verify GamePix games appear in public feed
- GET /api/games/{id}/play - Verify GamePix games can be played
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://instashare-80.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@hypd.games"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin authentication failed - skipping admin tests")


@pytest.fixture(scope="module")
def authenticated_admin_client(api_client, admin_token):
    """Session with admin auth header"""
    api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
    return api_client


class TestGamePixBrowseAPI:
    """Tests for /api/gamepix/browse endpoint"""
    
    def test_browse_returns_games(self, api_client):
        """GET /api/gamepix/browse should return games from GamePix RSS feed"""
        response = api_client.get(f"{BASE_URL}/api/gamepix/browse")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "games" in data
        assert "total" in data
        assert "page" in data
        assert "limit" in data
        assert "has_more" in data
        
        # Verify games array is not empty
        assert len(data["games"]) > 0
        
        # Verify game structure
        game = data["games"][0]
        assert "gpx_game_id" in game
        assert "title" in game
        assert "namespace" in game
        assert "play_url" in game
        assert "thumbnail_url" in game or "icon_url" in game
    
    def test_browse_with_pagination(self, api_client):
        """GET /api/gamepix/browse should support pagination"""
        response = api_client.get(f"{BASE_URL}/api/gamepix/browse", params={
            "page": 1,
            "limit": 12
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["page"] == 1
        assert data["limit"] == 12
        assert len(data["games"]) <= 12
    
    def test_browse_with_category_filter(self, api_client):
        """GET /api/gamepix/browse should filter by category"""
        response = api_client.get(f"{BASE_URL}/api/gamepix/browse", params={
            "category": "arcade"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return games (may be empty if no arcade games)
        assert "games" in data
    
    def test_browse_pagination_values(self, api_client):
        """GamePix only allows specific pagination values: 12, 24, 48, 96"""
        # Test with allowed value
        response = api_client.get(f"{BASE_URL}/api/gamepix/browse", params={
            "limit": 24
        })
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["games"]) <= 24


class TestGamePixCategoriesAPI:
    """Tests for /api/gamepix/categories endpoint"""
    
    def test_categories_returns_list(self, api_client):
        """GET /api/gamepix/categories should return available categories"""
        response = api_client.get(f"{BASE_URL}/api/gamepix/categories")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "categories" in data
        assert len(data["categories"]) > 0
        
        # Verify category structure
        category = data["categories"][0]
        assert "id" in category
        assert "name" in category
        assert "icon" in category
    
    def test_categories_includes_all_option(self, api_client):
        """Categories should include 'all' option"""
        response = api_client.get(f"{BASE_URL}/api/gamepix/categories")
        
        assert response.status_code == 200
        data = response.json()
        
        category_ids = [c["id"] for c in data["categories"]]
        assert "all" in category_ids
    
    def test_categories_includes_common_types(self, api_client):
        """Categories should include common game types"""
        response = api_client.get(f"{BASE_URL}/api/gamepix/categories")
        
        assert response.status_code == 200
        data = response.json()
        
        category_ids = [c["id"] for c in data["categories"]]
        
        # Check for common categories
        common_categories = ["action", "arcade", "puzzle", "sports"]
        for cat in common_categories:
            assert cat in category_ids, f"Missing common category: {cat}"


class TestGamePixSingleImport:
    """Tests for /api/admin/gamepix/import endpoint"""
    
    def test_import_requires_authentication(self, api_client):
        """POST /api/admin/gamepix/import should require authentication"""
        response = api_client.post(f"{BASE_URL}/api/admin/gamepix/import", json={
            "gpx_game_id": "test123",
            "title": "Test Game",
            "namespace": "test-game",
            "play_url": "https://play.gamepix.com/test-game/embed"
        })
        
        # Should return 403 (Forbidden) without auth
        assert response.status_code == 403
    
    def test_import_requires_admin(self, api_client):
        """POST /api/admin/gamepix/import should require admin role"""
        # Create a regular user and try to import
        unique_id = str(uuid.uuid4())[:8]
        
        # Register regular user
        reg_response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "username": f"testuser_{unique_id}",
            "email": f"testuser_{unique_id}@test.com",
            "password": "testpass123"
        })
        
        if reg_response.status_code == 200:
            user_token = reg_response.json().get("access_token")
            
            # Try to import with regular user token
            import_response = api_client.post(
                f"{BASE_URL}/api/admin/gamepix/import",
                headers={"Authorization": f"Bearer {user_token}"},
                json={
                    "gpx_game_id": "test123",
                    "title": "Test Game",
                    "namespace": f"test-game-{unique_id}",
                    "play_url": "https://play.gamepix.com/test-game/embed"
                }
            )
            
            # Should return 403 (Forbidden) for non-admin
            assert import_response.status_code == 403
    
    def test_import_game_success(self, authenticated_admin_client):
        """POST /api/admin/gamepix/import should import a game successfully"""
        unique_id = str(uuid.uuid4())[:8]
        
        response = authenticated_admin_client.post(f"{BASE_URL}/api/admin/gamepix/import", json={
            "gpx_game_id": f"TEST_{unique_id}",
            "title": f"Test GamePix Game {unique_id}",
            "namespace": f"test-gpx-game-{unique_id}",
            "description": "A test game for pytest",
            "category": "arcade",
            "thumbnail_url": "https://img.gamepix.com/test/cover.png",
            "icon_url": "https://img.gamepix.com/test/icon.png",
            "play_url": f"https://play.gamepix.com/test-gpx-game-{unique_id}/embed?sid=1M9DD"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "id" in data
        assert data["title"] == f"Test GamePix Game {unique_id}"
        assert data["source"] == "gamepix"
        assert data["gd_game_id"] == f"gpx-test-gpx-game-{unique_id}"
        assert data["has_game_file"] == True
        assert data["is_visible"] == True
        assert "embed_url" in data
    
    def test_import_duplicate_game_fails(self, authenticated_admin_client):
        """POST /api/admin/gamepix/import should fail for duplicate game"""
        unique_id = str(uuid.uuid4())[:8]
        
        game_data = {
            "gpx_game_id": f"DUP_{unique_id}",
            "title": f"Duplicate Test Game {unique_id}",
            "namespace": f"dup-test-game-{unique_id}",
            "play_url": f"https://play.gamepix.com/dup-test-game-{unique_id}/embed"
        }
        
        # First import should succeed
        response1 = authenticated_admin_client.post(f"{BASE_URL}/api/admin/gamepix/import", json=game_data)
        assert response1.status_code == 200
        
        # Second import should fail
        response2 = authenticated_admin_client.post(f"{BASE_URL}/api/admin/gamepix/import", json=game_data)
        assert response2.status_code == 400
        assert "already imported" in response2.json().get("detail", "").lower()


class TestGamePixBulkImport:
    """Tests for /api/admin/gamepix/bulk-import endpoint"""
    
    def test_bulk_import_requires_authentication(self, api_client):
        """POST /api/admin/gamepix/bulk-import should require authentication"""
        response = api_client.post(f"{BASE_URL}/api/admin/gamepix/bulk-import", json=[
            {
                "gpx_game_id": "test1",
                "title": "Test Game 1",
                "namespace": "test-game-1",
                "play_url": "https://play.gamepix.com/test-game-1/embed"
            }
        ])
        
        assert response.status_code == 403
    
    def test_bulk_import_success(self, authenticated_admin_client):
        """POST /api/admin/gamepix/bulk-import should import multiple games"""
        unique_id = str(uuid.uuid4())[:8]
        
        games_to_import = [
            {
                "gpx_game_id": f"BULK1_{unique_id}",
                "title": f"Bulk Test Game 1 {unique_id}",
                "namespace": f"bulk-test-1-{unique_id}",
                "description": "First bulk test game",
                "category": "puzzle",
                "play_url": f"https://play.gamepix.com/bulk-test-1-{unique_id}/embed"
            },
            {
                "gpx_game_id": f"BULK2_{unique_id}",
                "title": f"Bulk Test Game 2 {unique_id}",
                "namespace": f"bulk-test-2-{unique_id}",
                "description": "Second bulk test game",
                "category": "action",
                "play_url": f"https://play.gamepix.com/bulk-test-2-{unique_id}/embed"
            }
        ]
        
        response = authenticated_admin_client.post(f"{BASE_URL}/api/admin/gamepix/bulk-import", json=games_to_import)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "imported" in data
        assert "skipped" in data
        assert "imported_games" in data
        assert "skipped_games" in data
        
        # Verify both games were imported
        assert data["imported"] == 2
        assert data["skipped"] == 0
        assert len(data["imported_games"]) == 2
    
    def test_bulk_import_skips_duplicates(self, authenticated_admin_client):
        """POST /api/admin/gamepix/bulk-import should skip already imported games"""
        unique_id = str(uuid.uuid4())[:8]
        
        # First import a game
        first_game = {
            "gpx_game_id": f"SKIP_{unique_id}",
            "title": f"Skip Test Game {unique_id}",
            "namespace": f"skip-test-{unique_id}",
            "play_url": f"https://play.gamepix.com/skip-test-{unique_id}/embed"
        }
        
        authenticated_admin_client.post(f"{BASE_URL}/api/admin/gamepix/import", json=first_game)
        
        # Now try bulk import with the same game plus a new one
        games_to_import = [
            first_game,  # Already imported
            {
                "gpx_game_id": f"NEW_{unique_id}",
                "title": f"New Test Game {unique_id}",
                "namespace": f"new-test-{unique_id}",
                "play_url": f"https://play.gamepix.com/new-test-{unique_id}/embed"
            }
        ]
        
        response = authenticated_admin_client.post(f"{BASE_URL}/api/admin/gamepix/bulk-import", json=games_to_import)
        
        assert response.status_code == 200
        data = response.json()
        
        # One should be imported, one skipped
        assert data["imported"] == 1
        assert data["skipped"] == 1
        assert f"Skip Test Game {unique_id}" in data["skipped_games"]


class TestGamePixInPublicFeed:
    """Tests for GamePix games appearing in public feed"""
    
    def test_gamepix_games_in_public_feed(self, api_client):
        """GET /api/games should include GamePix games"""
        response = api_client.get(f"{BASE_URL}/api/games")
        
        assert response.status_code == 200
        games = response.json()
        
        # Find GamePix games
        gamepix_games = [g for g in games if g.get("source") == "gamepix"]
        
        # Should have at least one GamePix game (Prism Match 3D was pre-imported)
        assert len(gamepix_games) > 0
        
        # Verify GamePix game structure
        gpx_game = gamepix_games[0]
        assert gpx_game["source"] == "gamepix"
        assert gpx_game["gd_game_id"].startswith("gpx-")
        assert gpx_game["has_game_file"] == True
    
    def test_gamepix_game_has_embed_url(self, api_client):
        """GamePix games should have embed_url set"""
        response = api_client.get(f"{BASE_URL}/api/games")
        
        assert response.status_code == 200
        games = response.json()
        
        gamepix_games = [g for g in games if g.get("source") == "gamepix"]
        
        for game in gamepix_games:
            assert game.get("embed_url") is not None, f"Game {game['title']} missing embed_url"
            assert "gamepix.com" in game["embed_url"]


class TestGamePixPlayEndpoint:
    """Tests for playing GamePix games"""
    
    def test_play_gamepix_game_returns_html(self, api_client):
        """GET /api/games/{id}/play should return embed HTML for GamePix games"""
        # First get a GamePix game ID
        games_response = api_client.get(f"{BASE_URL}/api/games")
        games = games_response.json()
        
        gamepix_games = [g for g in games if g.get("source") == "gamepix"]
        if not gamepix_games:
            pytest.skip("No GamePix games available for testing")
        
        game_id = gamepix_games[0]["id"]
        
        # Test play endpoint
        response = api_client.get(f"{BASE_URL}/api/games/{game_id}/play")
        
        assert response.status_code == 200
        assert "text/html" in response.headers.get("content-type", "")
        
        html_content = response.text
        
        # Verify HTML contains iframe with GamePix URL
        assert "<iframe" in html_content
        assert "gamepix.com" in html_content
        assert "allowfullscreen" in html_content
    
    def test_play_gamepix_game_increments_play_count(self, api_client):
        """GET /api/games/{id}/play should increment play count"""
        # Get a GamePix game
        games_response = api_client.get(f"{BASE_URL}/api/games")
        games = games_response.json()
        
        gamepix_games = [g for g in games if g.get("source") == "gamepix"]
        if not gamepix_games:
            pytest.skip("No GamePix games available for testing")
        
        game = gamepix_games[0]
        game_id = game["id"]
        initial_play_count = game.get("play_count", 0)
        
        # Play the game
        api_client.get(f"{BASE_URL}/api/games/{game_id}/play")
        
        # Get updated game info
        updated_response = api_client.get(f"{BASE_URL}/api/games/{game_id}")
        updated_game = updated_response.json()
        
        # Play count should have increased
        assert updated_game["play_count"] > initial_play_count


class TestGamePixDataIntegrity:
    """Tests for GamePix data integrity"""
    
    def test_gamepix_game_id_format(self, api_client):
        """GamePix games should have gd_game_id prefixed with 'gpx-'"""
        response = api_client.get(f"{BASE_URL}/api/games")
        games = response.json()
        
        gamepix_games = [g for g in games if g.get("source") == "gamepix"]
        
        for game in gamepix_games:
            assert game["gd_game_id"].startswith("gpx-"), f"Game {game['title']} has invalid gd_game_id format"
    
    def test_gamepix_embed_url_contains_sid(self, api_client):
        """GamePix embed URLs should contain the publisher SID"""
        response = api_client.get(f"{BASE_URL}/api/games")
        games = response.json()
        
        gamepix_games = [g for g in games if g.get("source") == "gamepix"]
        
        for game in gamepix_games:
            embed_url = game.get("embed_url", "")
            # SID should be in the URL for stats tracking
            assert "sid=" in embed_url or "1M9DD" in embed_url, f"Game {game['title']} missing SID in embed URL"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
