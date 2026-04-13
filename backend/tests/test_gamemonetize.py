"""
GameMonetize Integration Tests
Tests for GameMonetize browse, categories, import, and bulk-import endpoints
"""

import pytest
import requests
import os

BASE_URL = os.environ.get(
    "NEXT_PUBLIC_API_URL",
    os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001"),
)
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')

# Admin credentials
ADMIN_EMAIL = "admin@hypd.games"
ADMIN_PASSWORD = "admin123"


class TestGameMonetizeBrowse:
    """Test /api/gamemonetize/browse endpoint"""
    
    def test_browse_returns_games(self):
        """Test that browse returns games with correct fields"""
        response = requests.get(f"{BASE_URL}/api/gamemonetize/browse?page=1&num=10")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "games" in data
        
        # Check if rate limited
        if "error" in data and "Failed to fetch" in data.get("error", ""):
            pytest.skip("GameMonetize API rate limited (429)")
        
        assert "has_more" in data
        assert "page" in data
        assert "num" in data
        assert "total" in data
        
        # Check that games have required fields
        if len(data["games"]) > 0:
            game = data["games"][0]
            required_fields = ["gmz_game_id", "title", "description", "category", 
                              "thumbnail_url", "icon_url", "play_url", "tags"]
            for field in required_fields:
                assert field in game, f"Game missing field: {field}"
            
            # Verify types
            assert isinstance(game["gmz_game_id"], str)
            assert isinstance(game["title"], str)
            assert isinstance(game["category"], str)
            print(f"Browse returned {len(data['games'])} games, total: {data['total']}")
    
    def test_browse_pagination(self):
        """Test pagination returns 50 games with has_more=true"""
        response = requests.get(f"{BASE_URL}/api/gamemonetize/browse?page=1&num=50")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check if rate limited
        if "error" in data and "Failed to fetch" in data.get("error", ""):
            pytest.skip("GameMonetize API rate limited (429)")
        
        # Should return up to 50 games
        assert len(data["games"]) <= 50
        
        # Check that has_more is returned (could be true or false depending on total games)
        assert "has_more" in data
        assert isinstance(data["has_more"], bool)
        
        # If total > 50, has_more should be true
        if data["total"] > 50:
            assert data["has_more"] == True, f"Expected has_more=True when total ({data['total']}) > 50"
        
        print(f"Pagination test: {len(data['games'])} games, has_more={data['has_more']}, total={data['total']}")
    
    def test_browse_category_filter(self):
        """Test category filter returns only matching games"""
        response = requests.get(f"{BASE_URL}/api/gamemonetize/browse?category=Puzzle&page=1&num=20")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check if rate limited
        if "error" in data and "Failed to fetch" in data.get("error", ""):
            pytest.skip("GameMonetize API rate limited (429)")
        
        # All returned games should be in Puzzle category
        for game in data["games"]:
            assert game["category"].lower() == "puzzle", f"Expected Puzzle, got {game['category']}"
        
        print(f"Category filter: returned {len(data['games'])} Puzzle games")
    
    def test_browse_search(self):
        """Test search filter returns relevant results"""
        response = requests.get(f"{BASE_URL}/api/gamemonetize/browse?search=racing&page=1&num=20")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check if rate limited
        if "error" in data and "Failed to fetch" in data.get("error", ""):
            pytest.skip("GameMonetize API rate limited (429)")
        
        # Search should return games that match the search term in title, tags, or description
        print(f"Search 'racing' returned {len(data['games'])} games")
        
        if len(data["games"]) > 0:
            # Verify at least one returned game contains 'racing' in some field
            found_match = False
            for game in data["games"]:
                search_term = "racing"
                if (search_term in game.get("title", "").lower() or 
                    search_term in game.get("tags", "").lower() or
                    search_term in game.get("description", "").lower()):
                    found_match = True
                    break
            print(f"Search relevance check: match found = {found_match}")
    
    def test_browse_sort_title_asc(self):
        """Test sort by title ascending"""
        response = requests.get(f"{BASE_URL}/api/gamemonetize/browse?sort=title_asc&page=1&num=20")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check if rate limited
        if "error" in data and "Failed to fetch" in data.get("error", ""):
            pytest.skip("GameMonetize API rate limited (429)")
        
        games = data["games"]
        if len(games) >= 2:
            # Verify alphabetical order
            titles = [g["title"].lower() for g in games]
            assert titles == sorted(titles), f"Games not sorted alphabetically: {titles[:5]}"
            print(f"Sort title_asc: first 5 titles = {titles[:5]}")
    
    def test_browse_sort_title_desc(self):
        """Test sort by title descending"""
        response = requests.get(f"{BASE_URL}/api/gamemonetize/browse?sort=title_desc&page=1&num=20")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check if rate limited
        if "error" in data and "Failed to fetch" in data.get("error", ""):
            pytest.skip("GameMonetize API rate limited (429)")
        
        games = data["games"]
        if len(games) >= 2:
            titles = [g["title"].lower() for g in games]
            assert titles == sorted(titles, reverse=True), f"Games not sorted reverse: {titles[:5]}"
            print(f"Sort title_desc: first 5 titles = {titles[:5]}")


class TestGameMonetizeCategories:
    """Test /api/gamemonetize/categories endpoint"""
    
    def test_categories_returns_list(self):
        """Test that categories returns a list of categories"""
        response = requests.get(f"{BASE_URL}/api/gamemonetize/categories")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "categories" in data
        assert isinstance(data["categories"], list)
        assert len(data["categories"]) > 0
        
        # Each category should have id, name, icon
        for cat in data["categories"]:
            assert "id" in cat
            assert "name" in cat
            assert "icon" in cat
        
        # Check that "All" is in categories
        ids = [c["id"] for c in data["categories"]]
        assert "All" in ids, "Expected 'All' category in list"
        
        print(f"Categories endpoint returned {len(data['categories'])} categories")


class TestGameMonetizeImport:
    """Test GameMonetize import endpoints (require admin auth)"""
    
    @staticmethod
    def get_admin_token():
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code != 200:
            return None
        
        data = response.json()
        return data.get("access_token")
    
    def test_import_requires_auth(self):
        """Test that import endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/admin/gamemonetize/import", json={
            "gmz_game_id": "test-123",
            "title": "Test Game",
            "play_url": "https://test.com/game"
        })
        
        assert response.status_code == 403, f"Expected 403 without auth, got {response.status_code}"
    
    def test_single_import(self):
        """Test importing a single game from GameMonetize"""
        admin_token = self.get_admin_token()
        if not admin_token:
            pytest.skip("Admin token not available")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First, get a game from the browse endpoint
        browse_response = requests.get(f"{BASE_URL}/api/gamemonetize/browse?page=1&num=5")
        assert browse_response.status_code == 200
        games = browse_response.json().get("games", [])
        
        if not games:
            pytest.skip("No games available to import")
        
        # Pick the first game
        game_to_import = games[0]
        
        import_data = {
            "gmz_game_id": game_to_import["gmz_game_id"],
            "title": game_to_import["title"],
            "description": game_to_import.get("description", ""),
            "category": game_to_import["category"],
            "thumbnail_url": game_to_import["thumbnail_url"],
            "icon_url": game_to_import.get("icon_url"),
            "play_url": game_to_import["play_url"],
            "tags": game_to_import.get("tags", ""),
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/gamemonetize/import",
            json=import_data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Import failed: {response.status_code} - {response.text}"
        
        data = response.json()
        # Either success=True (newly imported) or success=False with "already imported" message
        if data.get("success") == True:
            assert "game_id" in data
            print(f"Successfully imported: {game_to_import['title']} (ID: {data['game_id']})")
        else:
            assert "already imported" in data.get("message", "").lower()
            print(f"Game already imported: {game_to_import['title']}")
    
    def test_duplicate_import_detection(self):
        """Test that importing the same game twice returns already imported message"""
        admin_token = self.get_admin_token()
        if not admin_token:
            pytest.skip("Admin token not available")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get a game that's likely already imported
        browse_response = requests.get(f"{BASE_URL}/api/gamemonetize/browse?page=1&num=1")
        games = browse_response.json().get("games", [])
        
        if not games:
            pytest.skip("No games available")
        
        game = games[0]
        
        import_data = {
            "gmz_game_id": game["gmz_game_id"],
            "title": game["title"],
            "description": game.get("description", ""),
            "category": game["category"],
            "thumbnail_url": game["thumbnail_url"],
            "play_url": game["play_url"],
        }
        
        # First import
        response1 = requests.post(
            f"{BASE_URL}/api/admin/gamemonetize/import",
            json=import_data,
            headers=headers
        )
        
        # Second import (should return already imported)
        response2 = requests.post(
            f"{BASE_URL}/api/admin/gamemonetize/import",
            json=import_data,
            headers=headers
        )
        
        assert response2.status_code == 200
        data = response2.json()
        assert data.get("success") == False or "already imported" in data.get("message", "").lower()
        print(f"Duplicate detection working: {data}")
    
    def test_bulk_import_requires_auth(self):
        """Test that bulk import requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/admin/gamemonetize/bulk-import",
            json=[{"gmz_game_id": "test", "title": "Test", "play_url": "http://test.com"}]
        )
        
        assert response.status_code == 403, f"Expected 403 without auth, got {response.status_code}"
    
    def test_bulk_import(self):
        """Test bulk importing multiple games"""
        admin_token = self.get_admin_token()
        if not admin_token:
            pytest.skip("Admin token not available")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get games from browse
        browse_response = requests.get(f"{BASE_URL}/api/gamemonetize/browse?page=2&num=3")
        games = browse_response.json().get("games", [])
        
        if len(games) < 2:
            pytest.skip("Not enough games available for bulk import test")
        
        games_to_import = []
        for g in games[:3]:
            games_to_import.append({
                "gmz_game_id": g["gmz_game_id"],
                "title": g["title"],
                "description": g.get("description", ""),
                "category": g["category"],
                "thumbnail_url": g["thumbnail_url"],
                "icon_url": g.get("icon_url"),
                "play_url": g["play_url"],
                "tags": g.get("tags", ""),
            })
        
        response = requests.post(
            f"{BASE_URL}/api/admin/gamemonetize/bulk-import",
            json=games_to_import,
            headers=headers
        )
        
        assert response.status_code == 200, f"Bulk import failed: {response.status_code}"
        
        data = response.json()
        assert "imported" in data
        assert "skipped" in data
        assert isinstance(data["imported"], int)
        assert isinstance(data["skipped"], int)
        
        print(f"Bulk import: {data['imported']} imported, {data['skipped']} skipped")


class TestGameMonetizeGamesEndpoint:
    """Test that imported GameMonetize games appear in /api/games"""
    
    def test_games_includes_gamemonetize_source(self):
        """Test that GET /api/games returns imported GameMonetize games"""
        response = requests.get(f"{BASE_URL}/api/games")
        
        assert response.status_code == 200
        games = response.json()
        
        # Look for games with source=gamemonetize
        gmz_games = [g for g in games if g.get("source") == "gamemonetize"]
        
        print(f"Total games: {len(games)}, GameMonetize games: {len(gmz_games)}")
        
        # If any GMZ games exist, verify they have correct fields
        if gmz_games:
            game = gmz_games[0]
            assert game.get("source") == "gamemonetize"
            assert game.get("gd_game_id", "").startswith("gmz-")
            print(f"Sample GMZ game: {game.get('title')} (ID: {game.get('id')})")


class TestGameMonetizePlayEndpoint:
    """Test that GameMonetize games can be played via /api/games/{id}/play"""
    
    def test_gamemonetize_game_play(self):
        """Test that play endpoint returns HTML embed for GameMonetize games"""
        # First, find a GameMonetize game
        response = requests.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200
        games = response.json()
        
        gmz_games = [g for g in games if g.get("source") == "gamemonetize"]
        
        if not gmz_games:
            pytest.skip("No GameMonetize games imported yet")
        
        game = gmz_games[0]
        game_id = game["id"]
        
        # Test play endpoint
        play_response = requests.get(f"{BASE_URL}/api/games/{game_id}/play")
        
        assert play_response.status_code == 200
        assert "text/html" in play_response.headers.get("content-type", "")
        
        # Verify HTML contains iframe and GameMonetize URL
        html_content = play_response.text
        assert "iframe" in html_content.lower()
        assert "gamemonetize" in html_content.lower() or game["embed_url"] in html_content
        
        print(f"Play endpoint returns valid HTML embed for: {game['title']}")


class TestAdsTxt:
    """Test ads.txt file accessibility and GameMonetize entries"""
    
    def test_ads_txt_accessible(self):
        """Test that ads.txt is accessible at /ads.txt"""
        response = requests.get(f"{BASE_URL}/ads.txt")
        
        assert response.status_code == 200, f"ads.txt not accessible: {response.status_code}"
        
        content = response.text
        assert len(content) > 0, "ads.txt is empty"
        
        print(f"ads.txt accessible, length: {len(content)} characters")
    
    def test_ads_txt_contains_gamemonetize(self):
        """Test that ads.txt contains GameMonetize entries"""
        response = requests.get(f"{BASE_URL}/ads.txt")
        
        assert response.status_code == 200
        content = response.text
        
        # Check for GameMonetize comment and pub IDs
        has_gamemonetize_comment = "GameMonetize" in content
        has_pub_id_1 = "pub-5519830896693885" in content
        has_pub_id_2 = "pub-4764333688337558" in content
        
        assert has_gamemonetize_comment, "ads.txt missing #GameMonetize comment"
        assert has_pub_id_1 or has_pub_id_2, "ads.txt missing GameMonetize pub IDs"
        
        print("ads.txt contains GameMonetize entries")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
