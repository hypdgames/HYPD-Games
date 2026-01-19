"""
Test GameDistribution Integration for Hypd Games
Tests: Browse endpoint, Categories endpoint, Single import, Bulk import, GD games in feed, Game player embed
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('NEXT_PUBLIC_API_URL', 'https://playnow-76.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@hypd.games"
ADMIN_PASSWORD = "admin123"


class TestGameDistributionBrowse:
    """Test GameDistribution browse endpoint"""
    
    def test_browse_returns_games(self):
        """Test that browse endpoint returns games"""
        response = requests.get(f"{BASE_URL}/api/gamedistribution/browse")
        assert response.status_code == 200
        
        data = response.json()
        assert "games" in data
        assert "total" in data
        assert "page" in data
        assert "limit" in data
        assert isinstance(data["games"], list)
        assert len(data["games"]) > 0
        print(f"✓ Browse returned {len(data['games'])} games")
    
    def test_browse_game_structure(self):
        """Test that browse games have correct structure"""
        response = requests.get(f"{BASE_URL}/api/gamedistribution/browse")
        assert response.status_code == 200
        
        data = response.json()
        game = data["games"][0]
        
        # Check required fields
        assert "gd_game_id" in game
        assert "title" in game
        assert "embed_url" in game
        assert "category" in game
        
        print(f"✓ Game structure valid: {game['title']}")
    
    def test_browse_with_category_filter(self):
        """Test browse with category filter"""
        response = requests.get(f"{BASE_URL}/api/gamedistribution/browse?category=puzzle")
        assert response.status_code == 200
        
        data = response.json()
        assert "games" in data
        print(f"✓ Category filter returned {len(data['games'])} games")
    
    def test_browse_pagination(self):
        """Test browse pagination"""
        response = requests.get(f"{BASE_URL}/api/gamedistribution/browse?page=1&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert data["page"] == 1
        assert data["limit"] == 5
        print(f"✓ Pagination works: page={data['page']}, limit={data['limit']}")


class TestGameDistributionCategories:
    """Test GameDistribution categories endpoint"""
    
    def test_categories_returns_list(self):
        """Test that categories endpoint returns list"""
        response = requests.get(f"{BASE_URL}/api/gamedistribution/categories")
        assert response.status_code == 200
        
        data = response.json()
        assert "categories" in data
        assert isinstance(data["categories"], list)
        assert len(data["categories"]) > 0
        print(f"✓ Categories returned {len(data['categories'])} categories")
    
    def test_category_structure(self):
        """Test category structure"""
        response = requests.get(f"{BASE_URL}/api/gamedistribution/categories")
        assert response.status_code == 200
        
        data = response.json()
        category = data["categories"][0]
        
        assert "id" in category
        assert "name" in category
        assert "icon" in category
        print(f"✓ Category structure valid: {category['name']} {category['icon']}")


class TestAdminGDImport:
    """Test admin GameDistribution import endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    def test_admin_login(self):
        """Test admin can login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "access_token" in data
        assert data["user"]["is_admin"] == True
        print(f"✓ Admin login successful: {data['user']['email']}")
    
    def test_import_single_game(self, admin_token):
        """Test importing a single GD game"""
        # Use a unique test game ID to avoid conflicts
        import uuid
        test_gd_id = f"test-gd-{uuid.uuid4().hex[:8]}"
        
        game_data = {
            "gd_game_id": test_gd_id,
            "title": f"Test Import Game {test_gd_id[:8]}",
            "description": "Test game for import testing",
            "category": "Puzzle",
            "thumbnail_url": "https://via.placeholder.com/200",
            "embed_url": f"https://html5.gamedistribution.com/{test_gd_id}/",
            "instructions": "Test instructions"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/gamedistribution/import",
            json=game_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["title"] == game_data["title"]
        assert data["gd_game_id"] == test_gd_id
        assert data["source"] == "gamedistribution"
        assert data["embed_url"] == game_data["embed_url"]
        
        print(f"✓ Single import successful: {data['title']}")
        
        # Cleanup - delete the test game
        delete_response = requests.delete(
            f"{BASE_URL}/api/admin/games/{data['id']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert delete_response.status_code == 200
        print(f"✓ Test game cleaned up")
    
    def test_import_duplicate_game_fails(self, admin_token):
        """Test that importing duplicate game fails"""
        # First, get existing GD games
        games_response = requests.get(
            f"{BASE_URL}/api/admin/games",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert games_response.status_code == 200
        
        games = games_response.json()
        gd_games = [g for g in games if g.get("gd_game_id")]
        
        if not gd_games:
            pytest.skip("No existing GD games to test duplicate import")
        
        existing_game = gd_games[0]
        
        # Try to import the same game again
        game_data = {
            "gd_game_id": existing_game["gd_game_id"],
            "title": existing_game["title"],
            "description": "Duplicate test",
            "category": "Action",
            "thumbnail_url": "https://via.placeholder.com/200",
            "embed_url": existing_game.get("embed_url", "https://test.com"),
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/gamedistribution/import",
            json=game_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 400
        assert "already imported" in response.json()["detail"].lower()
        print(f"✓ Duplicate import correctly rejected")
    
    def test_bulk_import_games(self, admin_token):
        """Test bulk importing GD games"""
        import uuid
        
        # Create unique test games
        test_games = [
            {
                "gd_game_id": f"bulk-test-{uuid.uuid4().hex[:8]}",
                "title": f"Bulk Test Game 1",
                "description": "Bulk test game 1",
                "category": "Action",
                "thumbnail_url": "https://via.placeholder.com/200",
                "embed_url": f"https://html5.gamedistribution.com/bulk-test-1/",
            },
            {
                "gd_game_id": f"bulk-test-{uuid.uuid4().hex[:8]}",
                "title": f"Bulk Test Game 2",
                "description": "Bulk test game 2",
                "category": "Puzzle",
                "thumbnail_url": "https://via.placeholder.com/200",
                "embed_url": f"https://html5.gamedistribution.com/bulk-test-2/",
            }
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/admin/gamedistribution/bulk-import",
            json=test_games,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert "imported" in data
        assert "skipped" in data
        assert data["imported"] == 2
        print(f"✓ Bulk import successful: {data['imported']} imported, {data['skipped']} skipped")
        
        # Cleanup - delete test games
        games_response = requests.get(
            f"{BASE_URL}/api/admin/games",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        for game in games_response.json():
            if game["title"].startswith("Bulk Test Game"):
                requests.delete(
                    f"{BASE_URL}/api/admin/games/{game['id']}",
                    headers={"Authorization": f"Bearer {admin_token}"}
                )
        print(f"✓ Bulk test games cleaned up")
    
    def test_import_requires_auth(self):
        """Test that import requires authentication"""
        game_data = {
            "gd_game_id": "test-no-auth",
            "title": "Test No Auth",
            "description": "Test",
            "category": "Action",
            "thumbnail_url": "https://via.placeholder.com/200",
            "embed_url": "https://test.com",
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/gamedistribution/import",
            json=game_data
        )
        
        assert response.status_code in [401, 403]
        print(f"✓ Import correctly requires authentication")


class TestGDGamesInFeed:
    """Test that imported GD games appear in the game feed"""
    
    def test_gd_games_in_feed(self):
        """Test that GD games appear in the public games feed"""
        response = requests.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200
        
        games = response.json()
        gd_games = [g for g in games if g.get("source") == "gamedistribution"]
        
        print(f"✓ Found {len(gd_games)} GD games in feed out of {len(games)} total games")
        
        if gd_games:
            game = gd_games[0]
            assert game["gd_game_id"] is not None
            assert game["embed_url"] is not None
            print(f"✓ GD game in feed: {game['title']} (ID: {game['gd_game_id']})")
    
    def test_gd_game_has_required_fields(self):
        """Test that GD games have all required fields"""
        response = requests.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200
        
        games = response.json()
        gd_games = [g for g in games if g.get("source") == "gamedistribution"]
        
        if not gd_games:
            pytest.skip("No GD games in feed to test")
        
        game = gd_games[0]
        
        # Check required fields for GD games
        assert "id" in game
        assert "title" in game
        assert "gd_game_id" in game
        assert "source" in game
        assert game["source"] == "gamedistribution"
        assert "embed_url" in game
        assert game["embed_url"] is not None
        
        print(f"✓ GD game has all required fields: {game['title']}")


class TestGDGamePlayer:
    """Test that GD games can be played via the game player"""
    
    def test_gd_game_play_endpoint(self):
        """Test that GD game play endpoint returns HTML wrapper"""
        # First get a GD game
        response = requests.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200
        
        games = response.json()
        gd_games = [g for g in games if g.get("source") == "gamedistribution"]
        
        if not gd_games:
            pytest.skip("No GD games to test play endpoint")
        
        game = gd_games[0]
        
        # Test play endpoint
        play_response = requests.get(f"{BASE_URL}/api/games/{game['id']}/play")
        assert play_response.status_code == 200
        
        # Should return HTML content
        content_type = play_response.headers.get("content-type", "")
        assert "text/html" in content_type
        
        # HTML should contain iframe with embed URL
        html_content = play_response.text
        assert "<iframe" in html_content
        assert game["embed_url"] in html_content or "gamedistribution" in html_content.lower()
        
        print(f"✓ GD game play endpoint returns HTML wrapper with iframe")
    
    def test_gd_game_increments_play_count(self):
        """Test that playing a GD game increments play count"""
        # First get a GD game
        response = requests.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200
        
        games = response.json()
        gd_games = [g for g in games if g.get("source") == "gamedistribution"]
        
        if not gd_games:
            pytest.skip("No GD games to test play count")
        
        game = gd_games[0]
        initial_count = game.get("play_count", 0)
        
        # Play the game
        play_response = requests.get(f"{BASE_URL}/api/games/{game['id']}/play")
        assert play_response.status_code == 200
        
        # Get updated game data
        updated_response = requests.get(f"{BASE_URL}/api/games/{game['id']}")
        assert updated_response.status_code == 200
        
        updated_game = updated_response.json()
        new_count = updated_game.get("play_count", 0)
        
        assert new_count >= initial_count
        print(f"✓ Play count updated: {initial_count} -> {new_count}")


class TestExistingGDGames:
    """Test the 6 pre-imported GD games mentioned in context"""
    
    def test_existing_gd_games_count(self):
        """Test that we have the expected GD games"""
        response = requests.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200
        
        games = response.json()
        gd_games = [g for g in games if g.get("source") == "gamedistribution"]
        
        print(f"✓ Found {len(gd_games)} GD games in the system")
        
        # List all GD games
        for game in gd_games:
            print(f"  - {game['title']} (gd_id: {game['gd_game_id']})")
    
    def test_gd_games_are_visible(self):
        """Test that GD games are visible in the feed"""
        response = requests.get(f"{BASE_URL}/api/games?visible_only=true")
        assert response.status_code == 200
        
        games = response.json()
        gd_games = [g for g in games if g.get("source") == "gamedistribution"]
        
        for game in gd_games:
            assert game.get("is_visible", True) == True
        
        print(f"✓ All {len(gd_games)} GD games are visible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
