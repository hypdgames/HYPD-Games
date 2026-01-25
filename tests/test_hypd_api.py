"""
Backend API Tests for Hypd Games
Tests: Health, Auth, Games, Admin, Analytics, GameDistribution
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('NEXT_PUBLIC_API_URL', 'https://playswipe-1.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@hypd.games"
ADMIN_PASSWORD = "admin123"


class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_health_endpoint(self):
        """Test health check returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        print(f"✓ Health check passed: {data}")


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["is_admin"] == True
        print(f"✓ Admin login successful")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print(f"✓ Invalid login correctly rejected")
    
    def test_get_me_requires_auth(self):
        """Test /auth/me requires authentication"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403]
        print(f"✓ /auth/me correctly requires auth")


class TestGamesAPI:
    """Games API tests"""
    
    def test_get_games(self):
        """Test fetching games list"""
        response = requests.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Games list returned {len(data)} games")
    
    def test_get_games_with_category_filter(self):
        """Test fetching games with category filter"""
        response = requests.get(f"{BASE_URL}/api/games?category=Action")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Category filter returned {len(data)} games")
    
    def test_get_categories(self):
        """Test fetching categories"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        print(f"✓ Categories: {data['categories']}")
    
    def test_get_single_game(self):
        """Test fetching a single game"""
        # First get list of games
        games_response = requests.get(f"{BASE_URL}/api/games")
        games = games_response.json()
        
        if not games:
            pytest.skip("No games available")
        
        game_id = games[0]["id"]
        response = requests.get(f"{BASE_URL}/api/games/{game_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == game_id
        print(f"✓ Single game fetched: {data['title']}")
    
    def test_get_game_meta(self):
        """Test fetching game metadata"""
        games_response = requests.get(f"{BASE_URL}/api/games")
        games = games_response.json()
        
        if not games:
            pytest.skip("No games available")
        
        game_id = games[0]["id"]
        response = requests.get(f"{BASE_URL}/api/games/{game_id}/meta")
        assert response.status_code == 200
        data = response.json()
        assert "title" in data
        assert "description" in data
        print(f"✓ Game meta fetched: {data['title']}")
    
    def test_get_game_play(self):
        """Test game play endpoint returns HTML"""
        games_response = requests.get(f"{BASE_URL}/api/games")
        games = games_response.json()
        
        if not games:
            pytest.skip("No games available")
        
        game_id = games[0]["id"]
        response = requests.get(f"{BASE_URL}/api/games/{game_id}/play")
        assert response.status_code == 200
        assert "text/html" in response.headers.get("content-type", "")
        print(f"✓ Game play endpoint returns HTML")


class TestAnalyticsOverview:
    """Analytics Overview endpoint tests"""
    
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
    
    def test_analytics_overview_requires_auth(self):
        """Test that analytics overview requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/analytics/overview")
        assert response.status_code in [401, 403]
        print(f"✓ Analytics overview requires auth")
    
    def test_analytics_overview_success(self, auth_token):
        """Test analytics overview with valid auth"""
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/overview",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "total_games" in data
        assert "total_plays" in data
        assert "total_users" in data
        assert "today_plays" in data
        
        # Verify data types
        assert isinstance(data["total_games"], int)
        assert isinstance(data["total_plays"], int)
        assert isinstance(data["total_users"], int)
        
        print(f"✓ Analytics overview: {data['total_games']} games, {data['total_plays']} plays, {data['total_users']} users")


class TestAdminGames:
    """Admin Games management tests"""
    
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
    
    def test_admin_games_list_requires_auth(self):
        """Test that admin games list requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/games")
        assert response.status_code in [401, 403]
        print(f"✓ Admin games list requires auth")
    
    def test_admin_games_list_success(self, auth_token):
        """Test admin games list with valid auth"""
        response = requests.get(
            f"{BASE_URL}/api/admin/games",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin games list: {len(data)} games")
    
    def test_admin_toggle_visibility(self, auth_token):
        """Test toggling game visibility"""
        # Get a game
        games_response = requests.get(
            f"{BASE_URL}/api/admin/games",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        games = games_response.json()
        
        if not games:
            pytest.skip("No games available")
        
        game_id = games[0]["id"]
        
        # Toggle visibility
        response = requests.patch(
            f"{BASE_URL}/api/admin/games/{game_id}/visibility",
            json={"is_visible": True},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        print(f"✓ Game visibility toggled")


class TestSettings:
    """Settings endpoint tests"""
    
    def test_get_settings(self):
        """Test fetching app settings"""
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print(f"✓ Settings fetched: {list(data.keys())}")


class TestPlaySession:
    """Play session analytics tests"""
    
    def test_record_play_session(self):
        """Test recording a play session"""
        # Get a game
        games_response = requests.get(f"{BASE_URL}/api/games")
        games = games_response.json()
        
        if not games:
            pytest.skip("No games available")
        
        game_id = games[0]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/analytics/play-session",
            json={
                "game_id": game_id,
                "duration_seconds": 60,
                "score": 100
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print(f"✓ Play session recorded")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
