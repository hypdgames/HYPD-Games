"""
Pet Idle v3 (Gun Idle Style) Backend API Tests
Tests the save/load functionality for the idle game with shooting lanes layout
Each animal has its own shooting lane with projectile animation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://hypd-games-2.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@hypd.games"
TEST_PASSWORD = "admin123"


class TestIdleGameAuth:
    """Test authentication requirements for idle game endpoints"""
    
    def test_get_state_requires_auth(self):
        """GET /api/idle-game/state without auth returns 401/403"""
        response = requests.get(f"{BASE_URL}/api/idle-game/state")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("SUCCESS: GET state requires authentication")
    
    def test_save_state_requires_auth(self):
        """POST /api/idle-game/save without auth returns 401/403"""
        response = requests.post(
            f"{BASE_URL}/api/idle-game/save",
            json={"state": {"coins": 100}}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("SUCCESS: POST save requires authentication")


class TestIdleGameAPI:
    """Test idle game save/load with authentication"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        print(f"Authenticated as {TEST_EMAIL}")
    
    def test_get_state_with_auth(self):
        """GET /api/idle-game/state returns state for authenticated user"""
        response = requests.get(
            f"{BASE_URL}/api/idle-game/state",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "state" in data, "Response should contain 'state' key"
        print(f"SUCCESS: Got state with {len(data['state'])} fields")
    
    def test_save_v3_game_state(self):
        """POST /api/idle-game/save saves Gun Idle v3 state structure"""
        # Gun Idle v3 state structure with animal shooting lanes
        test_state = {
            "coins": 1000,
            "totalEarned": 5000,
            "playerLevel": 5,
            "playerXp": 15,
            "animals": {
                "bunny": 5,      # Bunny at level 5
                "kitty": 3,      # Kitty at level 3 (unlocks at player Lv.3)
                "pigy": 1        # Pigy at level 1 (unlocks at player Lv.5)
            },
            "targetHp": 100,
            "targetMaxHp": 200,
            "targetsDestroyed": 50,
            "prestigeLevel": 0,
            "prestigeMultiplier": 1,
            "lastTick": 1707500000000
        }
        
        response = requests.post(
            f"{BASE_URL}/api/idle-game/save",
            headers=self.headers,
            json={"state": test_state}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("success") == True, "Save should return success: true"
        print("SUCCESS: Saved Gun Idle v3 state")
    
    def test_verify_saved_state_persistence(self):
        """GET after save returns the saved state correctly"""
        # First save a specific state
        save_state = {
            "coins": 2500,
            "totalEarned": 8000,
            "playerLevel": 8,
            "playerXp": 5,
            "animals": {
                "bunny": 10,
                "kitty": 5,
                "pigy": 2,
                "s-whaly": 1  # S-Whaly unlocks at Lv.8
            },
            "targetHp": 50,
            "targetMaxHp": 300,
            "targetsDestroyed": 100,
            "prestigeLevel": 1,
            "prestigeMultiplier": 1.2,
            "lastTick": 1707600000000
        }
        
        # Save the state
        save_response = requests.post(
            f"{BASE_URL}/api/idle-game/save",
            headers=self.headers,
            json={"state": save_state}
        )
        assert save_response.status_code == 200, f"Save failed: {save_response.text}"
        
        # Get the state back
        get_response = requests.get(
            f"{BASE_URL}/api/idle-game/state",
            headers=self.headers
        )
        assert get_response.status_code == 200, f"Get failed: {get_response.text}"
        
        data = get_response.json()
        retrieved_state = data.get("state", {})
        
        # Verify key fields
        assert retrieved_state.get("coins") == 2500, "Coins should match"
        assert retrieved_state.get("playerLevel") == 8, "Player level should match"
        assert retrieved_state.get("targetsDestroyed") == 100, "Targets destroyed should match"
        assert "bunny" in retrieved_state.get("animals", {}), "Bunny should be in animals"
        assert "kitty" in retrieved_state.get("animals", {}), "Kitty should be in animals"
        assert "s-whaly" in retrieved_state.get("animals", {}), "S-Whaly should be in animals"
        assert retrieved_state.get("prestigeMultiplier") == 1.2, "Prestige multiplier should match"
        
        print("SUCCESS: State persisted and retrieved correctly")
        print(f"  Coins: {retrieved_state.get('coins')}")
        print(f"  Level: {retrieved_state.get('playerLevel')}")
        print(f"  Animals: {list(retrieved_state.get('animals', {}).keys())}")
    
    def test_invalid_save_request(self):
        """POST save with invalid body returns 422"""
        response = requests.post(
            f"{BASE_URL}/api/idle-game/save",
            headers=self.headers,
            json={}  # Missing 'state' key
        )
        # Should return 422 (validation error) or 400
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"
        print("SUCCESS: Invalid request returns appropriate error")
    
    def test_prestige_data_persistence(self):
        """Test that prestige data persists correctly"""
        prestige_state = {
            "coins": 0,
            "totalEarned": 100000,
            "playerLevel": 1,
            "playerXp": 0,
            "animals": {"bunny": 1},
            "targetHp": 10,
            "targetMaxHp": 10,
            "targetsDestroyed": 0,
            "prestigeLevel": 2,
            "prestigeMultiplier": 1.5,
            "lastTick": 1707700000000
        }
        
        # Save prestige state
        save_response = requests.post(
            f"{BASE_URL}/api/idle-game/save",
            headers=self.headers,
            json={"state": prestige_state}
        )
        assert save_response.status_code == 200, f"Save failed: {save_response.text}"
        
        # Retrieve and verify
        get_response = requests.get(
            f"{BASE_URL}/api/idle-game/state",
            headers=self.headers
        )
        assert get_response.status_code == 200, f"Get failed: {get_response.text}"
        
        retrieved = get_response.json().get("state", {})
        assert retrieved.get("prestigeLevel") == 2, "Prestige level should be 2"
        assert retrieved.get("prestigeMultiplier") == 1.5, "Prestige multiplier should be 1.5"
        assert retrieved.get("totalEarned") == 100000, "Total earned should persist"
        
        print("SUCCESS: Prestige data persisted correctly")


class TestHealthCheck:
    """Test health endpoint"""
    
    def test_health_endpoint(self):
        """GET /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("status") == "healthy", "Status should be healthy"
        print("SUCCESS: Health check passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
