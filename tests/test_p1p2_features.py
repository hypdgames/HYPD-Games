"""
Backend API Tests for P1/P2 Features
- Analytics Dashboard (Overview, Retention, Games tabs)
- CSV/JSON Export
- Admin game upload
- Authentication
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://instant-play-11.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@hypd.games"
ADMIN_PASSWORD = "admin123"


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
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401


class TestGamesAPI:
    """Games API tests"""
    
    def test_get_games(self):
        """Test fetching games list"""
        response = requests.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_categories(self):
        """Test fetching categories"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data


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
        # API returns 403 for missing auth
        assert response.status_code in [401, 403]
    
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
        assert "plays_today" in data
        assert "top_games" in data
        assert "plays_by_category" in data
        assert "plays_by_day" in data
        
        # Verify data types
        assert isinstance(data["total_games"], int)
        assert isinstance(data["total_plays"], int)
        assert isinstance(data["total_users"], int)
        assert isinstance(data["top_games"], list)
        assert isinstance(data["plays_by_day"], list)


class TestAnalyticsRetention:
    """Analytics Retention endpoint tests"""
    
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
    
    def test_retention_requires_auth(self):
        """Test that retention analytics requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/analytics/retention")
        assert response.status_code in [401, 403]
    
    def test_retention_success(self, auth_token):
        """Test retention analytics with valid auth"""
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/retention",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "retention" in data
        assert "cohorts" in data
        assert "dau_trend" in data
        assert "metrics" in data
        
        # Verify retention data structure
        retention = data["retention"]
        assert "day_1_rate" in retention
        assert "day_7_rate" in retention
        assert "day_30_rate" in retention
        
        # Verify metrics structure
        metrics = data["metrics"]
        assert "total_users" in metrics
        assert "active_users" in metrics
        assert "avg_sessions_per_user" in metrics


class TestAnalyticsExport:
    """Analytics Export endpoint tests"""
    
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
    
    def test_csv_export_requires_auth(self):
        """Test that CSV export requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/analytics/export/csv")
        assert response.status_code in [401, 403]
    
    def test_json_export_requires_auth(self):
        """Test that JSON export requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/analytics/export/json")
        assert response.status_code in [401, 403]
    
    def test_csv_export_success(self, auth_token):
        """Test CSV export with valid auth"""
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/export/csv",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("content-type", "")
        
        # Verify content has CSV structure
        content = response.text
        assert "HYPD Games Analytics Report" in content
        assert "Total Games" in content
    
    def test_json_export_success(self, auth_token):
        """Test JSON export with valid auth"""
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/export/json",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        assert "application/json" in response.headers.get("content-type", "")
        
        # Verify JSON structure
        data = response.json()
        assert "generated_at" in data
        assert "overview" in data
        assert "games" in data
        assert "daily_plays" in data


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
    
    def test_admin_games_list_success(self, auth_token):
        """Test admin games list with valid auth"""
        response = requests.get(
            f"{BASE_URL}/api/admin/games",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestGameAnalytics:
    """Individual game analytics tests"""
    
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
    
    @pytest.fixture
    def game_id(self, auth_token):
        """Get a game ID for testing"""
        response = requests.get(
            f"{BASE_URL}/api/admin/games",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        if response.status_code == 200:
            games = response.json()
            if games:
                return games[0]["id"]
        pytest.skip("No games available for testing")
    
    def test_game_analytics_success(self, auth_token, game_id):
        """Test individual game analytics"""
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/game/{game_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "game_id" in data
        assert "title" in data
        assert "total_plays" in data
        assert "unique_players" in data
        assert "daily_plays" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
