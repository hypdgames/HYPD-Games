"""
Test User Management APIs for Hypd Games Admin Dashboard
Tests: GET /api/admin/users, user stats, search, filters, ban/unban, make/remove admin, delete
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://gamescroll-2.preview.emergentagent.com').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "admin@hypd.games"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Get headers with admin auth token"""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def test_user(admin_headers):
    """Create a test user for testing ban/unban/admin operations"""
    unique_id = uuid.uuid4().hex[:8]
    user_data = {
        "username": f"TEST_user_{unique_id}",
        "email": f"TEST_user_{unique_id}@test.com",
        "password": "testpass123"
    }
    
    # Register test user
    response = requests.post(f"{BASE_URL}/api/auth/register", json=user_data)
    if response.status_code == 200:
        user = response.json()["user"]
        yield user
        # Cleanup: Delete test user
        requests.delete(
            f"{BASE_URL}/api/admin/users/{user['id']}",
            headers=admin_headers
        )
    else:
        pytest.skip(f"Could not create test user: {response.text}")


class TestUserManagementAPIs:
    """Test suite for User Management Admin APIs"""
    
    # ==================== GET /api/admin/users ====================
    
    def test_get_users_requires_auth(self):
        """GET /api/admin/users requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code == 403, "Should require authentication"
    
    def test_get_users_returns_list(self, admin_headers):
        """GET /api/admin/users returns paginated user list"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users?page=1&limit=10",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "users" in data
        assert "total" in data
        assert "page" in data
        assert "limit" in data
        assert "total_pages" in data
        
        # Verify users array
        assert isinstance(data["users"], list)
        assert len(data["users"]) > 0
        
        # Verify user object structure
        user = data["users"][0]
        assert "id" in user
        assert "username" in user
        assert "email" in user
        assert "is_admin" in user
        assert "is_banned" in user
        assert "created_at" in user
    
    def test_get_users_pagination(self, admin_headers):
        """GET /api/admin/users supports pagination"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users?page=1&limit=2",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["page"] == 1
        assert data["limit"] == 2
        assert len(data["users"]) <= 2
    
    def test_get_users_search_filter(self, admin_headers):
        """GET /api/admin/users supports search filter"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users?search=admin",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should find admin user
        assert len(data["users"]) >= 1
        usernames = [u["username"].lower() for u in data["users"]]
        emails = [u["email"].lower() for u in data["users"]]
        assert any("admin" in u or "admin" in e for u, e in zip(usernames, emails))
    
    def test_get_users_admin_filter(self, admin_headers):
        """GET /api/admin/users supports is_admin filter"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users?is_admin=true",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # All returned users should be admins
        for user in data["users"]:
            assert user["is_admin"] is True
    
    def test_get_users_banned_filter(self, admin_headers):
        """GET /api/admin/users supports is_banned filter"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users?is_banned=true",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # All returned users should be banned (or empty if none banned)
        for user in data["users"]:
            assert user["is_banned"] is True
    
    # ==================== GET /api/admin/users/stats/overview ====================
    
    def test_user_stats_requires_auth(self):
        """GET /api/admin/users/stats/overview requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/users/stats/overview")
        assert response.status_code == 403
    
    def test_user_stats_returns_overview(self, admin_headers):
        """GET /api/admin/users/stats/overview returns user statistics"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users/stats/overview",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "total_users" in data
        assert "admin_count" in data
        assert "banned_count" in data
        assert "new_today" in data
        assert "new_this_week" in data
        assert "new_this_month" in data
        assert "active_24h" in data
        
        # Verify data types
        assert isinstance(data["total_users"], int)
        assert isinstance(data["admin_count"], int)
        assert isinstance(data["banned_count"], int)
        assert data["total_users"] >= 1  # At least admin exists
        assert data["admin_count"] >= 1  # At least one admin
    
    # ==================== Ban/Unban User ====================
    
    def test_ban_user(self, admin_headers, test_user):
        """POST /api/admin/users/{id}/ban bans a user"""
        user_id = test_user["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/admin/users/{user_id}/ban?reason=Test%20ban",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        
        # Verify user is banned
        verify_response = requests.get(
            f"{BASE_URL}/api/admin/users?search={test_user['username']}",
            headers=admin_headers
        )
        assert verify_response.status_code == 200
        users = verify_response.json()["users"]
        banned_user = next((u for u in users if u["id"] == user_id), None)
        assert banned_user is not None
        assert banned_user["is_banned"] is True
    
    def test_unban_user(self, admin_headers, test_user):
        """POST /api/admin/users/{id}/unban unbans a user"""
        user_id = test_user["id"]
        
        # First ensure user is banned
        requests.post(
            f"{BASE_URL}/api/admin/users/{user_id}/ban",
            headers=admin_headers
        )
        
        # Now unban
        response = requests.post(
            f"{BASE_URL}/api/admin/users/{user_id}/unban",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        
        # Verify user is unbanned
        verify_response = requests.get(
            f"{BASE_URL}/api/admin/users?search={test_user['username']}",
            headers=admin_headers
        )
        users = verify_response.json()["users"]
        unbanned_user = next((u for u in users if u["id"] == user_id), None)
        assert unbanned_user is not None
        assert unbanned_user["is_banned"] is False
    
    def test_cannot_ban_self(self, admin_headers, admin_token):
        """Cannot ban yourself"""
        # Get admin user ID
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers=admin_headers
        )
        admin_id = response.json()["id"]
        
        # Try to ban self
        ban_response = requests.post(
            f"{BASE_URL}/api/admin/users/{admin_id}/ban",
            headers=admin_headers
        )
        assert ban_response.status_code == 400
    
    # ==================== Make/Remove Admin ====================
    
    def test_make_admin(self, admin_headers, test_user):
        """POST /api/admin/users/{id}/make-admin makes user an admin"""
        user_id = test_user["id"]
        
        # Ensure user is not banned first
        requests.post(
            f"{BASE_URL}/api/admin/users/{user_id}/unban",
            headers=admin_headers
        )
        
        response = requests.post(
            f"{BASE_URL}/api/admin/users/{user_id}/make-admin",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        
        # Verify user is admin
        verify_response = requests.get(
            f"{BASE_URL}/api/admin/users?search={test_user['username']}",
            headers=admin_headers
        )
        users = verify_response.json()["users"]
        admin_user = next((u for u in users if u["id"] == user_id), None)
        assert admin_user is not None
        assert admin_user["is_admin"] is True
    
    def test_remove_admin(self, admin_headers, test_user):
        """POST /api/admin/users/{id}/remove-admin removes admin status"""
        user_id = test_user["id"]
        
        # First make user admin
        requests.post(
            f"{BASE_URL}/api/admin/users/{user_id}/make-admin",
            headers=admin_headers
        )
        
        # Now remove admin
        response = requests.post(
            f"{BASE_URL}/api/admin/users/{user_id}/remove-admin",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        
        # Verify user is no longer admin
        verify_response = requests.get(
            f"{BASE_URL}/api/admin/users?search={test_user['username']}",
            headers=admin_headers
        )
        users = verify_response.json()["users"]
        non_admin_user = next((u for u in users if u["id"] == user_id), None)
        assert non_admin_user is not None
        assert non_admin_user["is_admin"] is False
    
    def test_cannot_remove_own_admin(self, admin_headers):
        """Cannot remove your own admin status"""
        # Get admin user ID
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers=admin_headers
        )
        admin_id = response.json()["id"]
        
        # Try to remove own admin
        remove_response = requests.post(
            f"{BASE_URL}/api/admin/users/{admin_id}/remove-admin",
            headers=admin_headers
        )
        assert remove_response.status_code == 400
    
    def test_cannot_make_banned_user_admin(self, admin_headers, test_user):
        """Cannot make a banned user an admin"""
        user_id = test_user["id"]
        
        # First remove admin status and ban user
        requests.post(
            f"{BASE_URL}/api/admin/users/{user_id}/remove-admin",
            headers=admin_headers
        )
        requests.post(
            f"{BASE_URL}/api/admin/users/{user_id}/ban",
            headers=admin_headers
        )
        
        # Try to make banned user admin
        response = requests.post(
            f"{BASE_URL}/api/admin/users/{user_id}/make-admin",
            headers=admin_headers
        )
        assert response.status_code == 400
        
        # Cleanup: unban user
        requests.post(
            f"{BASE_URL}/api/admin/users/{user_id}/unban",
            headers=admin_headers
        )
    
    # ==================== Delete User ====================
    
    def test_delete_user(self, admin_headers):
        """DELETE /api/admin/users/{id} deletes a user"""
        # Create a user to delete
        unique_id = uuid.uuid4().hex[:8]
        user_data = {
            "username": f"TEST_delete_{unique_id}",
            "email": f"TEST_delete_{unique_id}@test.com",
            "password": "testpass123"
        }
        
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json=user_data)
        if register_response.status_code != 200:
            pytest.skip("Could not create user for deletion test")
        
        user_id = register_response.json()["user"]["id"]
        
        # Delete the user
        response = requests.delete(
            f"{BASE_URL}/api/admin/users/{user_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        
        # Verify user is deleted
        verify_response = requests.get(
            f"{BASE_URL}/api/admin/users?search={user_data['username']}",
            headers=admin_headers
        )
        users = verify_response.json()["users"]
        deleted_user = next((u for u in users if u["id"] == user_id), None)
        assert deleted_user is None
    
    def test_cannot_delete_self(self, admin_headers):
        """Cannot delete yourself"""
        # Get admin user ID
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers=admin_headers
        )
        admin_id = response.json()["id"]
        
        # Try to delete self
        delete_response = requests.delete(
            f"{BASE_URL}/api/admin/users/{admin_id}",
            headers=admin_headers
        )
        assert delete_response.status_code == 400
    
    def test_cannot_delete_admin_user(self, admin_headers, test_user):
        """Cannot delete an admin user"""
        user_id = test_user["id"]
        
        # Make user admin first
        requests.post(
            f"{BASE_URL}/api/admin/users/{user_id}/unban",
            headers=admin_headers
        )
        requests.post(
            f"{BASE_URL}/api/admin/users/{user_id}/make-admin",
            headers=admin_headers
        )
        
        # Try to delete admin user
        response = requests.delete(
            f"{BASE_URL}/api/admin/users/{user_id}",
            headers=admin_headers
        )
        assert response.status_code == 400
        
        # Cleanup: remove admin status
        requests.post(
            f"{BASE_URL}/api/admin/users/{user_id}/remove-admin",
            headers=admin_headers
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
