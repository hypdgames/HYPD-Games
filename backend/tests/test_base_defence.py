"""
Tests for Base Defence Tower Defense Game API
Tests the idle game state save/load endpoints
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://instant-play-69.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "admin@hypd.games"
TEST_PASSWORD = "admin123"


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        assert data.get("database") == "connected"
        print(f"Health check: {data}")


class TestAuthentication:
    """Authentication tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        print(f"Login successful for: {data['user']['username']}")
        return data["access_token"]


class TestIdleGameStateAPI:
    """Test idle game state save/load endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Could not authenticate")
        return response.json()["access_token"]
    
    def test_get_state_without_auth_fails(self):
        """Test GET /api/idle-game/state requires authentication"""
        response = requests.get(f"{BASE_URL}/api/idle-game/state")
        assert response.status_code in [401, 403]
        print("GET state without auth correctly returns 401/403")
    
    def test_save_state_without_auth_fails(self):
        """Test POST /api/idle-game/save requires authentication"""
        response = requests.post(f"{BASE_URL}/api/idle-game/save", json={
            "state": {"test": "data"}
        })
        assert response.status_code in [401, 403]
        print("POST save without auth correctly returns 401/403")
    
    def test_get_state_with_auth(self, auth_token):
        """Test GET /api/idle-game/state with authentication"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/idle-game/state", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "state" in data
        print(f"GET state returned: {data}")
    
    def test_save_and_load_state(self, auth_token):
        """Test saving and loading Base Defence game state"""
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
        
        # Create a test game state matching Base Defence save format
        test_state = {
            "gold": 150,
            "lobbyLevels": {
                "l_damage": 2,
                "l_health": 1,
                "l_atkSpeed": 0
            },
            "gamesPlayed": 5,
            "bestTime": 180,
            "bestKills": 25
        }
        
        # Save the state
        save_response = requests.post(
            f"{BASE_URL}/api/idle-game/save",
            headers=headers,
            json={"state": test_state}
        )
        assert save_response.status_code == 200
        save_data = save_response.json()
        assert save_data.get("success") == True
        print(f"Save response: {save_data}")
        
        # Load the state back
        load_response = requests.get(
            f"{BASE_URL}/api/idle-game/state",
            headers=headers
        )
        assert load_response.status_code == 200
        load_data = load_response.json()
        
        # Verify the state was saved correctly
        loaded_state = load_data.get("state")
        assert loaded_state is not None
        assert loaded_state.get("gold") == 150
        assert loaded_state.get("gamesPlayed") == 5
        assert loaded_state.get("bestKills") == 25
        assert loaded_state.get("lobbyLevels", {}).get("l_damage") == 2
        print(f"Loaded state matches saved state: {loaded_state}")
    
    def test_save_state_validation(self, auth_token):
        """Test POST /api/idle-game/save validates request body"""
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
        
        # Send request without 'state' key
        response = requests.post(
            f"{BASE_URL}/api/idle-game/save",
            headers=headers,
            json={"invalid_key": "data"}
        )
        assert response.status_code == 422  # Validation error
        print("Save with missing 'state' key correctly returns 422")
    
    def test_save_complex_state(self, auth_token):
        """Test saving complex game state with all fields"""
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
        
        # Complex state with all lobby upgrades
        complex_state = {
            "gold": 500,
            "lobbyLevels": {
                "l_damage": 5,
                "l_health": 3,
                "l_atkSpeed": 4,
                "l_range": 2,
                "l_crit": 1,
                "l_poison": 0,
                "l_pierce": 1,
                "l_multi": 0,
                "l_xp": 3,
                "l_coin": 2,
                "l_regen": 1,
                "l_luck": 2
            },
            "gamesPlayed": 20,
            "bestTime": 450,  # 7.5 minutes
            "bestKills": 150
        }
        
        # Save the state
        save_response = requests.post(
            f"{BASE_URL}/api/idle-game/save",
            headers=headers,
            json={"state": complex_state}
        )
        assert save_response.status_code == 200
        
        # Load and verify
        load_response = requests.get(
            f"{BASE_URL}/api/idle-game/state",
            headers=headers
        )
        assert load_response.status_code == 200
        loaded = load_response.json().get("state")
        
        assert loaded["gold"] == 500
        assert loaded["bestTime"] == 450
        assert loaded["bestKills"] == 150
        assert loaded["lobbyLevels"]["l_damage"] == 5
        assert loaded["lobbyLevels"]["l_pierce"] == 1
        print(f"Complex state saved and loaded correctly: gold={loaded['gold']}, bestKills={loaded['bestKills']}")


class TestPageEndpoint:
    """Test the frontend page loads correctly"""
    
    def test_idle_game_page_loads(self):
        """Test /idle-game page returns HTML"""
        response = requests.get(f"{BASE_URL}/idle-game", allow_redirects=True)
        assert response.status_code == 200
        assert "text/html" in response.headers.get("content-type", "")
        # Check for key content
        assert "BASE DEFENCE" in response.text or "idle-game" in response.text
        print("Idle game page loads correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
