"""
Wallet/Coins System API Tests
Tests for coin packages, purchases, spending, and transaction history
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('NEXT_PUBLIC_API_URL', 'https://playswipe-1.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@hypd.games"
ADMIN_PASSWORD = "admin123"


class TestWalletPublicEndpoints:
    """Test public wallet endpoints (no auth required)"""
    
    def test_get_coin_packages(self):
        """GET /api/wallet/packages - returns available coin packages"""
        response = requests.get(f"{BASE_URL}/api/wallet/packages")
        assert response.status_code == 200
        
        data = response.json()
        assert "packages" in data
        packages = data["packages"]
        
        # Should have 5 packages
        assert len(packages) == 5
        
        # Verify package structure
        for pkg in packages:
            assert "package_id" in pkg
            assert "name" in pkg
            assert "coins" in pkg
            assert "bonus_coins" in pkg
            assert "total_coins" in pkg
            assert "price_usd" in pkg
            assert "is_popular" in pkg
        
        # Verify specific packages exist
        package_ids = [p["package_id"] for p in packages]
        assert "starter" in package_ids
        assert "popular" in package_ids
        assert "value" in package_ids
        assert "mega" in package_ids
        assert "ultimate" in package_ids
        
        # Verify popular package is marked
        popular_pkg = next(p for p in packages if p["package_id"] == "popular")
        assert popular_pkg["is_popular"] == True
        
        # Verify starter package values
        starter_pkg = next(p for p in packages if p["package_id"] == "starter")
        assert starter_pkg["coins"] == 100
        assert starter_pkg["price_usd"] == 0.99
        assert starter_pkg["bonus_coins"] == 0
        
        print(f"✓ Found {len(packages)} coin packages")
    
    def test_get_ad_free_options(self):
        """GET /api/wallet/ad-free-options - returns ad-free purchase options"""
        response = requests.get(f"{BASE_URL}/api/wallet/ad-free-options")
        assert response.status_code == 200
        
        data = response.json()
        assert "options" in data
        options = data["options"]
        
        # Should have 5 options
        assert len(options) == 5
        
        # Verify option structure
        for opt in options:
            assert "option_id" in opt
            assert "label" in opt
            assert "coins" in opt
            assert "hours" in opt
        
        # Verify specific options
        option_ids = [o["option_id"] for o in options]
        assert "1hour" in option_ids
        assert "4hours" in option_ids
        assert "1day" in option_ids
        assert "1week" in option_ids
        assert "1month" in option_ids
        
        # Verify 1 hour option values
        hour_opt = next(o for o in options if o["option_id"] == "1hour")
        assert hour_opt["coins"] == 25
        assert hour_opt["hours"] == 1
        assert hour_opt["label"] == "1 Hour"
        
        print(f"✓ Found {len(options)} ad-free options")


class TestWalletAuthenticatedEndpoints:
    """Test authenticated wallet endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        self.token = data["access_token"]
        self.user = data["user"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_wallet_info(self):
        """GET /api/wallet - returns user's wallet information"""
        response = requests.get(f"{BASE_URL}/api/wallet", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify wallet structure
        assert "coin_balance" in data
        assert "total_coins_purchased" in data
        assert "total_coins_spent" in data
        assert "total_coins_earned" in data
        assert "is_ad_free" in data
        assert "ad_free_until" in data
        
        # Verify types
        assert isinstance(data["coin_balance"], int)
        assert isinstance(data["total_coins_purchased"], int)
        assert isinstance(data["total_coins_spent"], int)
        assert isinstance(data["total_coins_earned"], int)
        assert isinstance(data["is_ad_free"], bool)
        
        print(f"✓ Wallet info: balance={data['coin_balance']}, is_ad_free={data['is_ad_free']}")
    
    def test_get_wallet_requires_auth(self):
        """GET /api/wallet - requires authentication"""
        response = requests.get(f"{BASE_URL}/api/wallet")
        assert response.status_code in [401, 403]
        print("✓ Wallet endpoint requires authentication")
    
    def test_get_transactions(self):
        """GET /api/wallet/transactions - returns transaction history"""
        response = requests.get(f"{BASE_URL}/api/wallet/transactions", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "transactions" in data
        assert "offset" in data
        assert "limit" in data
        
        # Transactions is a list
        assert isinstance(data["transactions"], list)
        
        # If there are transactions, verify structure
        if len(data["transactions"]) > 0:
            tx = data["transactions"][0]
            assert "id" in tx
            assert "transaction_type" in tx
            assert "status" in tx
            assert "coins" in tx
            assert "created_at" in tx
        
        print(f"✓ Found {len(data['transactions'])} transactions")
    
    def test_get_transactions_with_limit(self):
        """GET /api/wallet/transactions - respects limit parameter"""
        response = requests.get(f"{BASE_URL}/api/wallet/transactions?limit=5", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["limit"] == 5
        assert len(data["transactions"]) <= 5
        print("✓ Transactions endpoint respects limit parameter")
    
    def test_get_unlocked_games(self):
        """GET /api/wallet/unlocked-games - returns unlocked premium games"""
        response = requests.get(f"{BASE_URL}/api/wallet/unlocked-games", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "unlocked_game_ids" in data
        assert isinstance(data["unlocked_game_ids"], list)
        
        print(f"✓ Found {len(data['unlocked_game_ids'])} unlocked games")


class TestWalletPurchaseFlow:
    """Test coin purchase flow (Stripe integration)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        
        data = response.json()
        self.token = data["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_create_purchase_checkout(self):
        """POST /api/wallet/purchase - creates Stripe checkout session"""
        response = requests.post(
            f"{BASE_URL}/api/wallet/purchase",
            headers=self.headers,
            json={
                "package_id": "starter",
                "origin_url": "https://playswipe-1.preview.emergentagent.com"
            }
        )
        
        # Should return 200 with checkout URL (Stripe test mode)
        assert response.status_code == 200
        
        data = response.json()
        assert "checkout_url" in data
        assert "session_id" in data
        
        # Checkout URL should be a Stripe URL
        assert "stripe.com" in data["checkout_url"] or "checkout" in data["checkout_url"].lower()
        
        print(f"✓ Created checkout session: {data['session_id'][:20]}...")
    
    def test_purchase_invalid_package(self):
        """POST /api/wallet/purchase - rejects invalid package"""
        response = requests.post(
            f"{BASE_URL}/api/wallet/purchase",
            headers=self.headers,
            json={
                "package_id": "invalid_package",
                "origin_url": "https://playswipe-1.preview.emergentagent.com"
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "Invalid package" in data.get("detail", "")
        
        print("✓ Invalid package rejected correctly")
    
    def test_purchase_requires_auth(self):
        """POST /api/wallet/purchase - requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/wallet/purchase",
            json={
                "package_id": "starter",
                "origin_url": "https://playswipe-1.preview.emergentagent.com"
            }
        )
        
        assert response.status_code in [401, 403]
        print("✓ Purchase endpoint requires authentication")


class TestWalletSpendFlow:
    """Test coin spending flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        
        data = response.json()
        self.token = data["access_token"]
        self.user = data["user"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_spend_ad_free_insufficient_coins(self):
        """POST /api/wallet/spend - fails with insufficient coins"""
        # User likely has 0 coins, so this should fail
        response = requests.post(
            f"{BASE_URL}/api/wallet/spend",
            headers=self.headers,
            json={
                "spend_type": "ad_free",
                "option_id": "1hour"
            }
        )
        
        # Should fail with 400 if insufficient coins
        if self.user.get("coin_balance", 0) < 25:
            assert response.status_code == 400
            data = response.json()
            assert "Insufficient coins" in data.get("detail", "")
            print("✓ Spend correctly rejected due to insufficient coins")
        else:
            # If user has coins, it should succeed
            assert response.status_code == 200
            print("✓ Spend succeeded (user has coins)")
    
    def test_spend_invalid_option(self):
        """POST /api/wallet/spend - rejects invalid ad-free option"""
        response = requests.post(
            f"{BASE_URL}/api/wallet/spend",
            headers=self.headers,
            json={
                "spend_type": "ad_free",
                "option_id": "invalid_option"
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "Invalid" in data.get("detail", "")
        
        print("✓ Invalid ad-free option rejected correctly")
    
    def test_spend_invalid_type(self):
        """POST /api/wallet/spend - rejects invalid spend type"""
        response = requests.post(
            f"{BASE_URL}/api/wallet/spend",
            headers=self.headers,
            json={
                "spend_type": "invalid_type"
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "Invalid spend type" in data.get("detail", "")
        
        print("✓ Invalid spend type rejected correctly")
    
    def test_spend_requires_auth(self):
        """POST /api/wallet/spend - requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/wallet/spend",
            json={
                "spend_type": "ad_free",
                "option_id": "1hour"
            }
        )
        
        assert response.status_code in [401, 403]
        print("✓ Spend endpoint requires authentication")


class TestWalletDataInUserResponse:
    """Test that wallet data is included in user responses"""
    
    def test_login_returns_wallet_fields(self):
        """Login response includes wallet fields"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        
        data = response.json()
        user = data["user"]
        
        # Verify wallet fields in user response
        assert "coin_balance" in user
        assert "is_ad_free" in user
        assert "ad_free_until" in user
        
        print(f"✓ Login returns wallet fields: coin_balance={user['coin_balance']}, is_ad_free={user['is_ad_free']}")
    
    def test_auth_me_returns_wallet_fields(self):
        """GET /api/auth/me returns wallet fields"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_response.json()["access_token"]
        
        # Get user info
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        
        user = response.json()
        
        # Verify wallet fields
        assert "coin_balance" in user
        assert "is_ad_free" in user
        assert "ad_free_until" in user
        assert "total_coins_purchased" in user
        assert "total_coins_spent" in user
        assert "total_coins_earned" in user
        
        print(f"✓ /api/auth/me returns all wallet fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
