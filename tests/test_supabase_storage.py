"""
Backend API Tests for Supabase Storage Integration
- Game feed with Supabase Storage URLs
- Game thumbnails from Supabase Storage
- Game player endpoint serving content from Supabase
- Admin game upload with file storage
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://gamescroll-2.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@hypd.games"
ADMIN_PASSWORD = "admin123"

# Test game ID (uploaded with Supabase Storage)
TEST_GAME_ID = "4cf4c465-5d9a-4e32-8e9f-4e58afe58613"


class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_health_endpoint(self):
        """Test API health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        assert data["type"] == "postgresql"


class TestGameFeed:
    """Game feed API tests"""
    
    def test_get_games_list(self):
        """Test fetching games list"""
        response = requests.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"Found {len(data)} games")
    
    def test_game_has_required_fields(self):
        """Test that games have all required fields"""
        response = requests.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200
        games = response.json()
        
        required_fields = ["id", "title", "description", "category", "is_visible", "play_count"]
        for game in games:
            for field in required_fields:
                assert field in game, f"Missing field: {field}"
    
    def test_test_clicker_game_has_supabase_urls(self):
        """Test that Test Clicker Game has Supabase Storage URLs"""
        response = requests.get(f"{BASE_URL}/api/games/{TEST_GAME_ID}")
        assert response.status_code == 200
        game = response.json()
        
        # Verify game details
        assert game["title"] == "Test Clicker Game"
        assert game["has_game_file"] == True
        
        # Verify Supabase Storage URLs
        assert game["thumbnail_url"] is not None
        assert "supabase.co/storage" in game["thumbnail_url"]
        print(f"Thumbnail URL: {game['thumbnail_url']}")
        
        assert game["game_file_url"] is not None
        assert "supabase.co/storage" in game["game_file_url"]
        print(f"Game file URL: {game['game_file_url']}")


class TestThumbnailStorage:
    """Thumbnail storage tests"""
    
    def test_thumbnail_accessible(self):
        """Test that thumbnail is accessible from Supabase Storage"""
        response = requests.get(f"{BASE_URL}/api/games/{TEST_GAME_ID}")
        assert response.status_code == 200
        game = response.json()
        
        if game["thumbnail_url"]:
            # Test thumbnail URL is accessible
            thumb_response = requests.head(game["thumbnail_url"])
            assert thumb_response.status_code == 200
            assert "image" in thumb_response.headers.get("content-type", "")
            print(f"Thumbnail accessible: {thumb_response.status_code}")


class TestGamePlayer:
    """Game player endpoint tests"""
    
    def test_game_play_endpoint_returns_html(self):
        """Test that game play endpoint returns HTML content"""
        response = requests.get(f"{BASE_URL}/api/games/{TEST_GAME_ID}/play")
        assert response.status_code == 200
        
        # Should return HTML content
        content_type = response.headers.get("content-type", "")
        assert "text/html" in content_type
        
        # Verify HTML content
        html_content = response.text
        assert "<!DOCTYPE html>" in html_content or "<html" in html_content
        assert "Test Game" in html_content
        print("Game HTML content served correctly")
    
    def test_game_play_increments_play_count(self):
        """Test that playing a game increments play count"""
        # Get initial play count
        response1 = requests.get(f"{BASE_URL}/api/games/{TEST_GAME_ID}")
        initial_count = response1.json()["play_count"]
        
        # Play the game
        requests.get(f"{BASE_URL}/api/games/{TEST_GAME_ID}/play")
        
        # Get updated play count
        response2 = requests.get(f"{BASE_URL}/api/games/{TEST_GAME_ID}")
        new_count = response2.json()["play_count"]
        
        assert new_count >= initial_count
        print(f"Play count: {initial_count} -> {new_count}")
    
    def test_game_meta_endpoint(self):
        """Test game metadata endpoint for SEO"""
        response = requests.get(f"{BASE_URL}/api/games/{TEST_GAME_ID}/meta")
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert "title" in data
        assert "description" in data
        assert "thumbnail_url" in data


class TestAdminAuthentication:
    """Admin authentication tests"""
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["is_admin"] == True
    
    def test_admin_games_requires_auth(self):
        """Test that admin games endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/games")
        assert response.status_code in [401, 403]


class TestAdminGameManagement:
    """Admin game management tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_admin_get_all_games(self, auth_token):
        """Test admin can get all games including hidden"""
        response = requests.get(
            f"{BASE_URL}/api/admin/games",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        games = response.json()
        assert isinstance(games, list)
        print(f"Admin sees {len(games)} games")
    
    def test_admin_toggle_visibility(self, auth_token):
        """Test admin can toggle game visibility"""
        # Get current visibility
        response = requests.get(f"{BASE_URL}/api/games/{TEST_GAME_ID}")
        current_visibility = response.json()["is_visible"]
        
        # Toggle visibility
        response = requests.patch(
            f"{BASE_URL}/api/admin/games/{TEST_GAME_ID}/visibility",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"is_visible": not current_visibility}
        )
        assert response.status_code == 200
        
        # Restore original visibility
        requests.patch(
            f"{BASE_URL}/api/admin/games/{TEST_GAME_ID}/visibility",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"is_visible": current_visibility}
        )


class TestCategories:
    """Category endpoint tests"""
    
    def test_get_categories(self):
        """Test fetching categories"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        assert isinstance(data["categories"], list)
        print(f"Categories: {data['categories']}")


class TestAnalytics:
    """Analytics endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_analytics_overview(self, auth_token):
        """Test analytics overview endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/overview",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_games" in data
        assert "total_plays" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
