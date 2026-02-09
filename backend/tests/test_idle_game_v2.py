"""
Pet Idle Game API Tests - V2 Gun Idle Style
Tests for /api/idle-game/state and /api/idle-game/save endpoints
Tests new game mechanics: battle arena, target HP, auto-attack, player level, animal roster
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@hypd.games"
TEST_PASSWORD = "admin123"

class TestIdleGameAPIV2:
    """Test suite for Pet Idle Game v2 API endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for logged-in user tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access token in response"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    # Test 1: GET /api/idle-game/state - requires auth
    def test_get_state_requires_auth(self):
        """GET /api/idle-game/state should require authentication"""
        response = requests.get(f"{BASE_URL}/api/idle-game/state")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: GET /api/idle-game/state requires authentication")
    
    # Test 2: GET /api/idle-game/state - with auth returns state or null
    def test_get_state_with_auth(self, auth_headers):
        """GET /api/idle-game/state should return state for logged-in user"""
        response = requests.get(f"{BASE_URL}/api/idle-game/state", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "state" in data, "Response should contain 'state' key"
        print(f"PASS: GET /api/idle-game/state returns state")
    
    # Test 3: POST /api/idle-game/save - requires auth
    def test_save_state_requires_auth(self):
        """POST /api/idle-game/save should require authentication"""
        test_state = {"coins": 100, "animals": {"bunny": 1}}
        response = requests.post(f"{BASE_URL}/api/idle-game/save", json={"state": test_state})
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: POST /api/idle-game/save requires authentication")
    
    # Test 4: POST /api/idle-game/save - saves v2 Gun Idle state
    def test_save_state_v2_format(self, auth_headers):
        """POST /api/idle-game/save should save Gun Idle style game state"""
        # V2 state format with battle arena mechanics
        test_state = {
            "coins": 150,
            "totalEarned": 500,
            "playerLevel": 3,
            "playerXp": 5,
            "animals": {"bunny": 2, "kitty": 1},  # animalId -> level
            "targetHp": 15,
            "targetMaxHp": 20,
            "targetsDestroyed": 10,
            "prestigeLevel": 0,
            "prestigeMultiplier": 1,
            "lastTick": 1704067200000
        }
        response = requests.post(
            f"{BASE_URL}/api/idle-game/save",
            headers=auth_headers,
            json={"state": test_state}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True, f"Expected success: true, got {data}"
        print("PASS: POST /api/idle-game/save saves v2 state successfully")
    
    # Test 5: Verify saved v2 state can be retrieved
    def test_state_persistence_v2(self, auth_headers):
        """Saved v2 state should be retrievable via GET"""
        # Save unique state
        unique_coins = 777
        test_state = {
            "coins": unique_coins,
            "totalEarned": 1500,
            "playerLevel": 5,
            "playerXp": 3,
            "animals": {"bunny": 3, "kitty": 2, "pigy": 1},
            "targetHp": 25,
            "targetMaxHp": 40,
            "targetsDestroyed": 30,
            "prestigeLevel": 1,
            "prestigeMultiplier": 1.2,
            "lastTick": 1704067200000
        }
        
        save_response = requests.post(
            f"{BASE_URL}/api/idle-game/save",
            headers=auth_headers,
            json={"state": test_state}
        )
        assert save_response.status_code == 200, f"Save failed: {save_response.text}"
        
        # Retrieve and verify
        get_response = requests.get(f"{BASE_URL}/api/idle-game/state", headers=auth_headers)
        assert get_response.status_code == 200, f"GET failed: {get_response.text}"
        data = get_response.json()
        
        assert data.get("state") is not None, "State should not be null after saving"
        assert data["state"]["coins"] == unique_coins, f"Expected coins={unique_coins}"
        assert data["state"]["playerLevel"] == 5, "Expected playerLevel=5"
        assert data["state"]["targetsDestroyed"] == 30, "Expected targetsDestroyed=30"
        assert "bunny" in data["state"]["animals"], "Expected bunny in animals"
        assert data["state"]["animals"]["bunny"] == 3, "Expected bunny level=3"
        print("PASS: V2 state persists correctly - all fields verified")
    
    # Test 6: POST /api/idle-game/save - validates request body
    def test_save_invalid_payload(self, auth_headers):
        """POST /api/idle-game/save should validate request body"""
        # Send empty object (missing 'state' key)
        response = requests.post(
            f"{BASE_URL}/api/idle-game/save",
            headers=auth_headers,
            json={}
        )
        assert response.status_code == 422, f"Expected 422 for invalid payload, got {response.status_code}"
        print("PASS: POST /api/idle-game/save validates request body")
    
    # Test 7: Verify prestige data saves correctly
    def test_prestige_state_persistence(self, auth_headers):
        """Prestige multiplier and level should persist"""
        test_state = {
            "coins": 0,
            "totalEarned": 100000,  # Enough for prestige bonus
            "playerLevel": 1,
            "playerXp": 0,
            "animals": {"bunny": 1},
            "targetHp": 10,
            "targetMaxHp": 10,
            "targetsDestroyed": 0,
            "prestigeLevel": 2,
            "prestigeMultiplier": 1.5,
            "lastTick": 1704067200000
        }
        
        save_response = requests.post(
            f"{BASE_URL}/api/idle-game/save",
            headers=auth_headers,
            json={"state": test_state}
        )
        assert save_response.status_code == 200
        
        get_response = requests.get(f"{BASE_URL}/api/idle-game/state", headers=auth_headers)
        data = get_response.json()
        
        assert data["state"]["prestigeLevel"] == 2
        assert data["state"]["prestigeMultiplier"] == 1.5
        print("PASS: Prestige data persists correctly")


class TestHealthCheck:
    """Basic API health check"""
    
    def test_health_endpoint(self):
        """Test /api/health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy", f"Expected healthy status, got {data}"
        print(f"PASS: Health check - database: {data.get('database')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
