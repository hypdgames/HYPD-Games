"""
Pet Idle Game API Tests
Tests for /api/idle-game/state and /api/idle-game/save endpoints
"""

import pytest
import requests
import os
from backend.tests.helpers import ADMIN_EMAIL, ADMIN_PASSWORD, BASE_URL

# Test credentials
TEST_EMAIL = ADMIN_EMAIL
TEST_PASSWORD = ADMIN_PASSWORD

class TestIdleGameAPI:
    """Test suite for Pet Idle Game API endpoints"""
    
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
        print(f"PASS: GET /api/idle-game/state returns state (value: {data['state']})")
    
    # Test 3: POST /api/idle-game/save - requires auth
    def test_save_state_requires_auth(self):
        """POST /api/idle-game/save should require authentication"""
        test_state = {"coins": 100, "grid": [1, None, None]}
        response = requests.post(f"{BASE_URL}/api/idle-game/save", json={"state": test_state})
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: POST /api/idle-game/save requires authentication")
    
    # Test 4: POST /api/idle-game/save - saves state
    def test_save_state_with_auth(self, auth_headers):
        """POST /api/idle-game/save should save game state"""
        test_state = {
            "grid": [1, 1, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None],
            "coins": 150,
            "totalEarned": 200,
            "totalPurchased": 2,
            "prestigeLevel": 0,
            "prestigeMultiplier": 1,
            "highestTier": 1,
            "cpsUpgradeLevel": 0,
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
        print("PASS: POST /api/idle-game/save saves state successfully")
    
    # Test 5: Verify saved state can be retrieved
    def test_state_persistence(self, auth_headers):
        """Saved state should be retrievable via GET"""
        # First save a unique state
        unique_coins = 999
        test_state = {
            "grid": [1, 2, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None],
            "coins": unique_coins,
            "totalEarned": 1000,
            "totalPurchased": 3,
            "prestigeLevel": 0,
            "prestigeMultiplier": 1,
            "highestTier": 2,
            "cpsUpgradeLevel": 0,
            "lastTick": 1704067200000
        }
        
        save_response = requests.post(
            f"{BASE_URL}/api/idle-game/save",
            headers=auth_headers,
            json={"state": test_state}
        )
        assert save_response.status_code == 200, f"Save failed: {save_response.text}"
        
        # Now retrieve and verify
        get_response = requests.get(f"{BASE_URL}/api/idle-game/state", headers=auth_headers)
        assert get_response.status_code == 200, f"GET failed: {get_response.text}"
        data = get_response.json()
        
        assert data.get("state") is not None, "State should not be null after saving"
        assert data["state"]["coins"] == unique_coins, f"Expected coins={unique_coins}, got {data['state']['coins']}"
        assert data["state"]["highestTier"] == 2, f"Expected highestTier=2, got {data['state']['highestTier']}"
        print("PASS: State persists correctly - save and retrieve verified")
    
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
