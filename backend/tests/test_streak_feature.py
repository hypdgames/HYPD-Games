"""
Test suite for Daily Login Streak Feature
Tests:
- Login endpoint returns streak data in user object
- /api/user/streak endpoint returns correct streak info
- /api/user/streak/leaderboard endpoint returns leaderboard
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('NEXT_PUBLIC_API_URL', 'https://playswipe-1.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@hypd.games"
ADMIN_PASSWORD = "admin123"

# Test user for registration
TEST_USER_EMAIL = f"TEST_streak_user_{os.urandom(4).hex()}@test.com"
TEST_USER_PASSWORD = "TestPass123"
TEST_USER_USERNAME = f"TEST_streak_{os.urandom(4).hex()}"


class TestHealthCheck:
    """Basic health check to ensure API is running"""
    
    def test_health_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        print(f"✓ Health check passed: {data}")


class TestLoginStreakData:
    """Test that login endpoint returns streak data"""
    
    def test_login_returns_streak_fields(self):
        """Login should return user object with streak fields"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify access token exists
        assert "access_token" in data, "Missing access_token in response"
        assert len(data["access_token"]) > 0, "Empty access_token"
        
        # Verify user object exists
        assert "user" in data, "Missing user object in response"
        user = data["user"]
        
        # Verify streak fields exist in user object
        streak_fields = ["login_streak", "best_login_streak", "total_login_days", "streak_points", "last_login_date"]
        for field in streak_fields:
            assert field in user, f"Missing streak field: {field}"
            print(f"  ✓ {field}: {user[field]}")
        
        # Verify streak values are valid
        assert isinstance(user["login_streak"], int), "login_streak should be int"
        assert isinstance(user["best_login_streak"], int), "best_login_streak should be int"
        assert isinstance(user["total_login_days"], int), "total_login_days should be int"
        assert isinstance(user["streak_points"], int), "streak_points should be int"
        assert user["login_streak"] >= 0, "login_streak should be >= 0"
        assert user["best_login_streak"] >= 0, "best_login_streak should be >= 0"
        
        print(f"✓ Login returns all streak fields correctly")
        return data["access_token"]


class TestUserStreakEndpoint:
    """Test /api/user/streak endpoint"""
    
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
    
    def test_streak_endpoint_requires_auth(self):
        """Streak endpoint should require authentication"""
        response = requests.get(f"{BASE_URL}/api/user/streak")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Streak endpoint requires authentication")
    
    def test_streak_endpoint_returns_data(self, auth_token):
        """Streak endpoint should return streak information"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/user/streak", headers=headers)
        
        assert response.status_code == 200, f"Streak endpoint failed: {response.text}"
        data = response.json()
        
        # Verify all expected fields
        expected_fields = [
            "current_streak", "best_streak", "total_login_days", 
            "streak_points", "last_login_date", "streak_active",
            "next_milestone", "days_to_milestone", "current_multiplier"
        ]
        
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
            print(f"  ✓ {field}: {data[field]}")
        
        # Verify data types
        assert isinstance(data["current_streak"], int), "current_streak should be int"
        assert isinstance(data["best_streak"], int), "best_streak should be int"
        assert isinstance(data["total_login_days"], int), "total_login_days should be int"
        assert isinstance(data["streak_points"], int), "streak_points should be int"
        assert isinstance(data["streak_active"], bool), "streak_active should be bool"
        assert isinstance(data["current_multiplier"], (int, float)), "current_multiplier should be numeric"
        
        # Verify logical constraints
        assert data["current_streak"] >= 0, "current_streak should be >= 0"
        assert data["best_streak"] >= data["current_streak"] or data["current_streak"] == 1, \
            "best_streak should be >= current_streak (unless just started)"
        
        print("✓ Streak endpoint returns all expected data")


class TestStreakLeaderboard:
    """Test /api/user/streak/leaderboard endpoint"""
    
    def test_leaderboard_endpoint_public(self):
        """Leaderboard should be accessible without auth"""
        response = requests.get(f"{BASE_URL}/api/user/streak/leaderboard")
        
        assert response.status_code == 200, f"Leaderboard failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "leaderboard" in data, "Missing leaderboard array"
        assert isinstance(data["leaderboard"], list), "leaderboard should be a list"
        
        print(f"✓ Leaderboard returned {len(data['leaderboard'])} entries")
        
        # If there are entries, verify structure
        if len(data["leaderboard"]) > 0:
            entry = data["leaderboard"][0]
            expected_fields = ["rank", "username", "login_streak", "best_streak", "streak_points"]
            
            for field in expected_fields:
                assert field in entry, f"Missing field in leaderboard entry: {field}"
            
            # Verify ranking is correct
            for i, entry in enumerate(data["leaderboard"]):
                assert entry["rank"] == i + 1, f"Incorrect rank: expected {i+1}, got {entry['rank']}"
                print(f"  #{entry['rank']} {entry['username']}: {entry['login_streak']} day streak, {entry['streak_points']} points")
        
        print("✓ Leaderboard structure is correct")
    
    def test_leaderboard_limit_parameter(self):
        """Leaderboard should respect limit parameter"""
        response = requests.get(f"{BASE_URL}/api/user/streak/leaderboard?limit=5")
        
        assert response.status_code == 200, f"Leaderboard with limit failed: {response.text}"
        data = response.json()
        
        assert len(data["leaderboard"]) <= 5, "Leaderboard should respect limit parameter"
        print(f"✓ Leaderboard respects limit parameter (returned {len(data['leaderboard'])} entries)")


class TestNewUserStreak:
    """Test streak behavior for new user registration"""
    
    def test_new_user_starts_with_streak(self):
        """New user should start with streak of 1 after first login"""
        # Register new user
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "username": TEST_USER_USERNAME,
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        
        # May fail if user already exists from previous test run
        if register_response.status_code == 400:
            print("⚠ Test user already exists, skipping registration test")
            pytest.skip("Test user already exists")
        
        assert register_response.status_code == 200, f"Registration failed: {register_response.text}"
        data = register_response.json()
        
        # Verify user has initial streak data
        user = data["user"]
        
        # After registration (which is also first login), streak should be 1
        # Note: Registration might not trigger streak logic - depends on implementation
        print(f"  New user streak: {user.get('login_streak', 'N/A')}")
        print(f"  New user points: {user.get('streak_points', 'N/A')}")
        
        # Now login to trigger streak
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        login_data = login_response.json()
        user = login_data["user"]
        
        # After first login, streak should be at least 1
        assert user["login_streak"] >= 1, f"Expected streak >= 1, got {user['login_streak']}"
        assert user["streak_points"] >= 10, f"Expected points >= 10, got {user['streak_points']}"
        
        print(f"✓ New user has streak: {user['login_streak']}, points: {user['streak_points']}")


class TestAuthMeEndpoint:
    """Test /api/auth/me returns streak data"""
    
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
    
    def test_auth_me_returns_streak_fields(self, auth_token):
        """GET /api/auth/me should return user with streak fields"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 200, f"Auth/me failed: {response.text}"
        user = response.json()
        
        # Verify streak fields
        streak_fields = ["login_streak", "best_login_streak", "total_login_days", "streak_points", "last_login_date"]
        for field in streak_fields:
            assert field in user, f"Missing streak field in /auth/me: {field}"
            print(f"  ✓ {field}: {user[field]}")
        
        print("✓ /api/auth/me returns all streak fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
