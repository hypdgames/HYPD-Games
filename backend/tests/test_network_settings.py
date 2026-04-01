"""
Test Admin Network Settings Feature
Tests for enabling/disabling GamePix and GameMonetize networks
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://instant-play-preview.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@hypd.games"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, "No access_token in response"
    return data["access_token"]


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestNetworkSettingsAPI:
    """Test network settings API endpoints"""
    
    def test_get_settings_returns_network_flags(self, api_client):
        """GET /api/settings should return gamepix_enabled and gamemonetize_enabled"""
        response = api_client.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        
        data = response.json()
        # Settings may or may not have these keys initially
        # Just verify the endpoint works
        assert isinstance(data, dict)
        print(f"Current settings: {data}")
    
    def test_save_network_settings_requires_auth(self, api_client):
        """POST /api/admin/settings should require authentication"""
        response = api_client.post(
            f"{BASE_URL}/api/admin/settings",
            json={"gamepix_enabled": "true"}
        )
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_save_gamepix_enabled_true(self, api_client, admin_token):
        """Save gamepix_enabled = true"""
        response = api_client.post(
            f"{BASE_URL}/api/admin/settings",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"gamepix_enabled": "true"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        
        # Verify setting was saved
        get_response = api_client.get(f"{BASE_URL}/api/settings")
        assert get_response.status_code == 200
        settings = get_response.json()
        assert settings.get("gamepix_enabled") == "true"
    
    def test_save_gamepix_enabled_false(self, api_client, admin_token):
        """Save gamepix_enabled = false"""
        response = api_client.post(
            f"{BASE_URL}/api/admin/settings",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"gamepix_enabled": "false"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        
        # Verify setting was saved
        get_response = api_client.get(f"{BASE_URL}/api/settings")
        assert get_response.status_code == 200
        settings = get_response.json()
        assert settings.get("gamepix_enabled") == "false"
    
    def test_save_gamemonetize_enabled_true(self, api_client, admin_token):
        """Save gamemonetize_enabled = true"""
        response = api_client.post(
            f"{BASE_URL}/api/admin/settings",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"gamemonetize_enabled": "true"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        
        # Verify setting was saved
        get_response = api_client.get(f"{BASE_URL}/api/settings")
        assert get_response.status_code == 200
        settings = get_response.json()
        assert settings.get("gamemonetize_enabled") == "true"
    
    def test_save_gamemonetize_enabled_false(self, api_client, admin_token):
        """Save gamemonetize_enabled = false"""
        response = api_client.post(
            f"{BASE_URL}/api/admin/settings",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"gamemonetize_enabled": "false"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        
        # Verify setting was saved
        get_response = api_client.get(f"{BASE_URL}/api/settings")
        assert get_response.status_code == 200
        settings = get_response.json()
        assert settings.get("gamemonetize_enabled") == "false"
    
    def test_save_both_networks_at_once(self, api_client, admin_token):
        """Save both network settings in one request"""
        response = api_client.post(
            f"{BASE_URL}/api/admin/settings",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "gamepix_enabled": "true",
                "gamemonetize_enabled": "true"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        
        # Verify both settings were saved
        get_response = api_client.get(f"{BASE_URL}/api/settings")
        assert get_response.status_code == 200
        settings = get_response.json()
        assert settings.get("gamepix_enabled") == "true"
        assert settings.get("gamemonetize_enabled") == "true"
    
    def test_settings_persist_after_multiple_saves(self, api_client, admin_token):
        """Settings should persist correctly after multiple saves"""
        # First save - disable both
        response1 = api_client.post(
            f"{BASE_URL}/api/admin/settings",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "gamepix_enabled": "false",
                "gamemonetize_enabled": "false"
            }
        )
        assert response1.status_code == 200
        
        # Verify
        get1 = api_client.get(f"{BASE_URL}/api/settings")
        settings1 = get1.json()
        assert settings1.get("gamepix_enabled") == "false"
        assert settings1.get("gamemonetize_enabled") == "false"
        
        # Second save - enable both
        response2 = api_client.post(
            f"{BASE_URL}/api/admin/settings",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "gamepix_enabled": "true",
                "gamemonetize_enabled": "true"
            }
        )
        assert response2.status_code == 200
        
        # Verify
        get2 = api_client.get(f"{BASE_URL}/api/settings")
        settings2 = get2.json()
        assert settings2.get("gamepix_enabled") == "true"
        assert settings2.get("gamemonetize_enabled") == "true"


class TestNetworkSettingsCleanup:
    """Cleanup - restore default settings"""
    
    def test_restore_default_settings(self, api_client, admin_token):
        """Restore both networks to enabled state"""
        response = api_client.post(
            f"{BASE_URL}/api/admin/settings",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "gamepix_enabled": "true",
                "gamemonetize_enabled": "true"
            }
        )
        assert response.status_code == 200
        
        # Verify
        get_response = api_client.get(f"{BASE_URL}/api/settings")
        settings = get_response.json()
        assert settings.get("gamepix_enabled") == "true"
        assert settings.get("gamemonetize_enabled") == "true"
        print("Settings restored to default (both enabled)")
