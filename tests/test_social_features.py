"""
Test Social Features - Friends, Leaderboards, Challenges, Analytics
Tests for Hypd Games social features implementation
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://playswipe-1.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@hypd.games"
ADMIN_PASSWORD = "admin123"

# Test user credentials for social features
TEST_USER_1 = {
    "username": f"testuser1_{uuid.uuid4().hex[:6]}",
    "email": f"testuser1_{uuid.uuid4().hex[:6]}@test.com",
    "password": "testpass123"
}

TEST_USER_2 = {
    "username": f"testuser2_{uuid.uuid4().hex[:6]}",
    "email": f"testuser2_{uuid.uuid4().hex[:6]}@test.com",
    "password": "testpass123"
}


class TestLeaderboardAPI:
    """Test Leaderboard endpoints"""
    
    def test_global_leaderboard(self):
        """Test global leaderboard endpoint"""
        response = requests.get(f"{BASE_URL}/api/leaderboard/global")
        assert response.status_code == 200
        data = response.json()
        assert "leaderboard" in data
        assert isinstance(data["leaderboard"], list)
        print(f"Global leaderboard returned {len(data['leaderboard'])} entries")
    
    def test_game_leaderboard(self):
        """Test game-specific leaderboard endpoint"""
        # First get a game ID
        games_response = requests.get(f"{BASE_URL}/api/games")
        assert games_response.status_code == 200
        games = games_response.json()
        
        if len(games) > 0:
            game_id = games[0]["id"]
            response = requests.get(f"{BASE_URL}/api/leaderboard/game/{game_id}")
            assert response.status_code == 200
            data = response.json()
            assert "leaderboard" in data
            print(f"Game leaderboard for {game_id} returned {len(data['leaderboard'])} entries")
        else:
            pytest.skip("No games available to test game leaderboard")


class TestFriendsAPI:
    """Test Friends system endpoints"""
    
    @pytest.fixture(scope="class")
    def user1_token(self):
        """Register and get token for test user 1"""
        # Try to register
        response = requests.post(f"{BASE_URL}/api/auth/register", json=TEST_USER_1)
        if response.status_code == 200:
            return response.json()["access_token"]
        # If already exists, try login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_1["email"],
            "password": TEST_USER_1["password"]
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Could not create/login test user 1")
    
    @pytest.fixture(scope="class")
    def user2_token(self):
        """Register and get token for test user 2"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json=TEST_USER_2)
        if response.status_code == 200:
            return response.json()["access_token"]
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_2["email"],
            "password": TEST_USER_2["password"]
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Could not create/login test user 2")
    
    @pytest.fixture(scope="class")
    def user2_id(self, user2_token):
        """Get user 2's ID"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        if response.status_code == 200:
            return response.json()["id"]
        pytest.skip("Could not get user 2 ID")
    
    def test_search_users(self, user1_token):
        """Test user search endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/users/search?q=test",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        print(f"User search returned {len(data['users'])} users")
    
    def test_search_users_requires_auth(self):
        """Test that user search requires authentication"""
        response = requests.get(f"{BASE_URL}/api/users/search?q=test")
        assert response.status_code in [401, 403]
    
    def test_get_friends_list(self, user1_token):
        """Test getting friends list"""
        response = requests.get(
            f"{BASE_URL}/api/friends",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "friends" in data
        assert isinstance(data["friends"], list)
        print(f"Friends list returned {len(data['friends'])} friends")
    
    def test_get_friend_requests(self, user1_token):
        """Test getting friend requests"""
        response = requests.get(
            f"{BASE_URL}/api/friends/requests",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "requests" in data
        assert isinstance(data["requests"], list)
        print(f"Friend requests returned {len(data['requests'])} requests")
    
    def test_send_friend_request(self, user1_token, user2_id):
        """Test sending a friend request"""
        response = requests.post(
            f"{BASE_URL}/api/friends/request",
            headers={"Authorization": f"Bearer {user1_token}"},
            json={"user_id": user2_id}
        )
        # Could be 200 (success) or 400 (already exists)
        assert response.status_code in [200, 400]
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            print("Friend request sent successfully")
        else:
            print("Friend request already exists or pending")
    
    def test_cannot_friend_self(self, user1_token):
        """Test that user cannot send friend request to themselves"""
        # Get user1's ID
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        if me_response.status_code == 200:
            user1_id = me_response.json()["id"]
            response = requests.post(
                f"{BASE_URL}/api/friends/request",
                headers={"Authorization": f"Bearer {user1_token}"},
                json={"user_id": user1_id}
            )
            assert response.status_code == 400
            print("Correctly rejected self-friend request")


class TestChallengesAPI:
    """Test Challenges endpoints"""
    
    @pytest.fixture(scope="class")
    def user_token(self):
        """Get a user token for testing"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Could not login for challenges test")
    
    def test_get_challenges(self, user_token):
        """Test getting active challenges"""
        response = requests.get(
            f"{BASE_URL}/api/challenges",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "challenges" in data
        assert isinstance(data["challenges"], list)
        print(f"Challenges returned {len(data['challenges'])} active challenges")
    
    def test_challenges_requires_auth(self):
        """Test that challenges endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/challenges")
        assert response.status_code in [401, 403]


class TestAdminAnalyticsAPI:
    """Test Admin Analytics endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_analytics_overview(self, admin_token):
        """Test analytics overview endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/overview",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check overview structure
        assert "overview" in data
        overview = data["overview"]
        assert "total_users" in overview
        assert "total_games" in overview
        assert "total_plays" in overview
        assert "new_users_today" in overview
        assert "plays_today" in overview
        assert "active_users_24h" in overview
        
        # Check categories
        assert "categories" in data
        assert isinstance(data["categories"], list)
        
        # Check top games
        assert "top_games" in data
        assert isinstance(data["top_games"], list)
        
        print(f"Analytics overview: {overview['total_users']} users, {overview['total_games']} games, {overview['total_plays']} plays")
    
    def test_analytics_daily(self, admin_token):
        """Test daily analytics endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/daily?days=14",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "daily_stats" in data
        assert isinstance(data["daily_stats"], list)
        
        if len(data["daily_stats"]) > 0:
            day = data["daily_stats"][0]
            assert "date" in day
            assert "plays" in day
            assert "unique_players" in day
            assert "new_users" in day
        
        print(f"Daily analytics returned {len(data['daily_stats'])} days of data")
    
    def test_analytics_retention(self, admin_token):
        """Test retention analytics endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/retention",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "retention" in data
        retention = data["retention"]
        assert "day_1" in retention
        assert "day_3" in retention
        assert "day_7" in retention
        assert "total_new_users" in retention
        
        print(f"Retention data: Day 1: {retention.get('day_1_pct', 0)}%, Day 3: {retention.get('day_3_pct', 0)}%, Day 7: {retention.get('day_7_pct', 0)}%")
    
    def test_analytics_requires_admin(self):
        """Test that analytics endpoints require admin access"""
        # Try without auth
        response = requests.get(f"{BASE_URL}/api/admin/analytics/overview")
        assert response.status_code in [401, 403]
        
        # Try with non-admin user (if we have one)
        # For now, just verify auth is required
        print("Analytics endpoints correctly require authentication")


class TestScoreSubmission:
    """Test score submission and leaderboard updates"""
    
    @pytest.fixture(scope="class")
    def user_token(self):
        """Get a user token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Could not login for score submission test")
    
    def test_submit_score(self, user_token):
        """Test submitting a score"""
        # Get a game ID first
        games_response = requests.get(f"{BASE_URL}/api/games")
        if games_response.status_code != 200 or len(games_response.json()) == 0:
            pytest.skip("No games available for score submission test")
        
        game_id = games_response.json()[0]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/leaderboard/submit",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "game_id": game_id,
                "score": 1000,
                "play_time": 120
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"Score submitted successfully. New high score: {data.get('new_high_score')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
