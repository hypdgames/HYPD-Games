#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class HypdGamesAPITester:
    def __init__(self, base_url="https://instant-play-11.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.user_id = None
        self.admin_user_id = None
        self.created_game_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_user_registration(self):
        """Test user registration"""
        test_user_data = {
            "username": f"testuser_{datetime.now().strftime('%H%M%S')}",
            "email": f"test_{datetime.now().strftime('%H%M%S')}@example.com",
            "password": "testpass123"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_user_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            print(f"   User ID: {self.user_id}")
            return True
        return False

    def test_admin_login(self):
        """Test admin login with provided credentials"""
        admin_data = {
            "email": "admin@hypd.games",
            "password": "admin123"
        }
        
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data=admin_data
        )
        
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            self.admin_user_id = response['user']['id']
            print(f"   Admin User ID: {self.admin_user_id}")
            print(f"   Is Admin: {response['user']['is_admin']}")
            return True
        return False

    def test_get_games(self):
        """Test getting games list"""
        success, response = self.run_test(
            "Get Games List",
            "GET",
            "games",
            200
        )
        
        if success:
            print(f"   Found {len(response)} games")
            return True
        return False

    def test_get_categories(self):
        """Test getting categories"""
        success, response = self.run_test(
            "Get Categories",
            "GET",
            "categories",
            200
        )
        
        if success:
            categories = response.get('categories', [])
            print(f"   Found categories: {categories}")
            return True
        return False

    def test_get_settings(self):
        """Test getting site settings"""
        success, response = self.run_test(
            "Get Settings",
            "GET",
            "settings",
            200
        )
        
        if success:
            print(f"   Settings: {response}")
            return True
        return False

    def test_user_profile(self):
        """Test getting user profile"""
        if not self.token:
            print("❌ No user token available for profile test")
            return False
            
        headers = {'Authorization': f'Bearer {self.token}'}
        success, response = self.run_test(
            "Get User Profile",
            "GET",
            "auth/me",
            200,
            headers=headers
        )
        
        if success:
            print(f"   Username: {response.get('username')}")
            print(f"   Email: {response.get('email')}")
            return True
        return False

    def test_admin_seed_games(self):
        """Test seeding sample games"""
        if not self.admin_token:
            print("❌ No admin token available for seeding test")
            return False
            
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        success, response = self.run_test(
            "Seed Sample Games",
            "POST",
            "admin/seed",
            200,
            headers=headers
        )
        
        if success:
            print(f"   Message: {response.get('message')}")
            return True
        return False

    def test_admin_create_game(self):
        """Test creating a new game via admin"""
        if not self.admin_token:
            print("❌ No admin token available for game creation test")
            return False
            
        game_data = {
            "title": "Test Game",
            "description": "A test game created by automated testing",
            "category": "Action",
            "thumbnail_url": "https://images.unsplash.com/photo-1637734373619-af1e76434bec?w=800&q=80",
            "is_visible": True
        }
        
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        success, response = self.run_test(
            "Create Game (Admin)",
            "POST",
            "admin/games",
            200,
            data=game_data,
            headers=headers
        )
        
        if success and 'id' in response:
            self.created_game_id = response['id']
            print(f"   Created Game ID: {self.created_game_id}")
            return True
        return False

    def test_get_specific_game(self):
        """Test getting a specific game"""
        if not self.created_game_id:
            print("❌ No game ID available for specific game test")
            return False
            
        success, response = self.run_test(
            "Get Specific Game",
            "GET",
            f"games/{self.created_game_id}",
            200
        )
        
        if success:
            print(f"   Game Title: {response.get('title')}")
            print(f"   Game Category: {response.get('category')}")
            return True
        return False

    def test_save_game(self):
        """Test saving a game to user profile"""
        if not self.token or not self.created_game_id:
            print("❌ No user token or game ID available for save game test")
            return False
            
        headers = {'Authorization': f'Bearer {self.token}'}
        success, response = self.run_test(
            "Save Game to Profile",
            "POST",
            f"auth/save-game/{self.created_game_id}",
            200,
            headers=headers
        )
        
        if success:
            print(f"   Message: {response.get('message')}")
            return True
        return False

    def test_game_play_endpoint(self):
        """Test game play endpoint"""
        if not self.created_game_id:
            print("❌ No game ID available for play endpoint test")
            return False
            
        # This should return HTML content or increment play count
        url = f"{self.base_url}/api/games/{self.created_game_id}/play"
        print(f"\n🔍 Testing Game Play Endpoint...")
        print(f"   URL: {url}")
        
        try:
            response = requests.get(url)
            # Could be 200 (HTML content) or 404 (no game file)
            if response.status_code in [200, 404]:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                if response.status_code == 200:
                    print(f"   Content Type: {response.headers.get('content-type')}")
                return True
            else:
                print(f"❌ Failed - Unexpected status: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False
        finally:
            self.tests_run += 1

    def test_admin_toggle_visibility(self):
        """Test toggling game visibility"""
        if not self.admin_token or not self.created_game_id:
            print("❌ No admin token or game ID available for visibility test")
            return False
            
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        success, response = self.run_test(
            "Toggle Game Visibility",
            "POST",
            f"admin/toggle-visibility/{self.created_game_id}",
            200,
            headers=headers
        )
        
        if success:
            print(f"   Message: {response.get('message')}")
            print(f"   Is Visible: {response.get('is_visible')}")
            return True
        return False

    def test_admin_delete_game(self):
        """Test deleting a game"""
        if not self.admin_token or not self.created_game_id:
            print("❌ No admin token or game ID available for delete test")
            return False
            
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        success, response = self.run_test(
            "Delete Game (Admin)",
            "DELETE",
            f"admin/games/{self.created_game_id}",
            200,
            headers=headers
        )
        
        if success:
            print(f"   Message: {response.get('message')}")
            return True
        return False

def main():
    print("🚀 Starting Hypd Games API Testing...")
    print("=" * 50)
    
    tester = HypdGamesAPITester()
    
    # Test sequence
    tests = [
        ("Basic Endpoints", [
            tester.test_get_games,
            tester.test_get_categories,
            tester.test_get_settings,
        ]),
        ("User Authentication", [
            tester.test_user_registration,
            tester.test_user_profile,
        ]),
        ("Admin Authentication", [
            tester.test_admin_login,
        ]),
        ("Admin Game Management", [
            tester.test_admin_seed_games,
            tester.test_admin_create_game,
            tester.test_get_specific_game,
            tester.test_game_play_endpoint,
            tester.test_admin_toggle_visibility,
        ]),
        ("User Game Interaction", [
            tester.test_save_game,
        ]),
        ("Cleanup", [
            tester.test_admin_delete_game,
        ])
    ]
    
    for section_name, section_tests in tests:
        print(f"\n📋 {section_name}")
        print("-" * 30)
        
        for test_func in section_tests:
            test_func()
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())