# Hypd Games - Product Requirements Document

## Original Problem Statement
Build "Hypd Games," a mobile-first instant gaming website with a vertical, "TikTok-style" endless scroll feed. React (Next.js) frontend, Python (FastAPI) backend, PostgreSQL (Supabase) database.

## Core Features Implemented
- **Game Feed (Redesigned)**: Full-screen TikTok-style vertical scroll with GMZ video previews, Play Now button overlay, game info at bottom, Save/Share side buttons, swipe navigation. Thumbnail image fallback when no video URL available.
- **GameMonetize Video Previews**: Batch-fetches all video URLs at feed load. In-memory cache per hash (1h TTL) + batch-level cache (30min TTL). Lazy loads — only active card shows video.
- **Admin Feed Toggle**: `show_in_feed` boolean field on games. Toggle button (TvMinimalPlay icon) in admin GamesTab.
- **Multi-Network Game Integration**: GamePix and GameMonetize providers (both active)
- **Admin Dashboard**: Game management, network settings, bulk operations, 7 tabs (Games, GamePix, GMZ, Upload, Users, Stats, Settings)
- **Daily Login Streaks**: Track and reward consecutive daily logins
- **Consolidated Profile Page**: Refactored into child components (Streak, Games, Wallet, Friends tabs)
- **Wallet/Coin System**: Coin balance, packages (Stripe MOCKED/disabled)
- **Friends System**: Search, add, accept/decline, remove
- **Base Defence Game (Tower Defense)**: Canvas-based pixel art survival game
- **GameMonetize Integration**: Browse, search, filter, sort, import/bulk-import games. Embed wrapper for playback. ads.txt updated.
- **ads.txt**: Contains entries for Google AdSense, GamePix, and GameMonetize
- **Explore Page**: Redesigned with horizontally-scrolling carousels — Recommended, Categories, New Games, Trending, per-category rows.
- **Bottom Navbar**: Floating pill-style, supports dark/light mode.
- **Performance**: Server-side in-memory TTL caching (5min for games/categories), batch-level video URL cache (30min), startup pre-warm + periodic 4-min re-warm, sessionStorage client-side caching.

## Hidden/Disabled Features
- **Pro/Ad-Free features**: All Pro-related UI hidden. ProTab.tsx deleted. Can be re-enabled.
- **Stripe payments**: Mocked/disabled, awaiting API key.

## Architecture
```
/app/
├── backend/
│   ├── server.py (GamePix, GameMonetize, idle game, auth, admin endpoints + in-memory cache)
│   ├── cache.py (Redis helpers, unused in production — no Redis configured)
│   ├── models.py (Game.show_in_feed column added)
│   ├── alembic/versions/a1b2c3d4e5f6_add_show_in_feed_to_games.py
│   └── database.py
├── frontend/
│   ├── next.config.js (NEW: image optimization, static asset caching headers)
│   └── src/app/
│       ├── page.tsx (REDESIGNED: video feed + sessionStorage caching for games/video URLs)
│       ├── explore/explore-page.tsx (REDESIGNED: multi-carousel + sessionStorage caching)
│       ├── defence-game/ (Base Defence tower defense game)
│       ├── admin/ (Admin dashboard, 7 tabs, feed toggle)
│       ├── profile/ (child components, AdminSection link)
│       └── components/
│           └── bottom-nav.tsx (REDESIGNED: floating pill, light/dark mode)
```

## Key API Endpoints
- `GET /api/games` — Game feed/explore (cached 5min in-memory, invalidated on admin change)
- `GET /api/categories` — Categories list (cached 5min in-memory)
- `GET /api/games/video-previews-batch` — Batch video URLs (per-hash cache 1h + batch cache 30min)
- `PATCH /api/admin/games/{id}/feed-visibility` — Toggle feed vs explore-only
- `PATCH /api/admin/games/{id}/visibility` — Toggle full visibility on/off
- `GET /api/gamemonetize/browse` — Browse GameMonetize games
- `GET /api/gamemonetize/categories` — GameMonetize categories
- `POST /api/admin/gamemonetize/import` — Import single game
- `POST /api/admin/gamemonetize/bulk-import` — Bulk import games
- `GET /api/gamepix/browse` — Browse GamePix games
- `POST /api/admin/gamepix/bulk-import` — Bulk import GamePix games
- `GET /api/games/{id}/play` — Play game (embed wrapper)
- `GET/POST /api/idle-game/state|save` — Defence game state

## Performance Metrics
- **Before optimization**: /api/games = 3.77s, /api/categories = 0.74s, video-batch = 2.87s
- **After optimization**: /api/games = 0.14-0.24s (cached), /api/categories = 0.09s, video-batch = 0.10s
- **Strategy**: Server-side in-memory cache (5min TTL) + startup pre-warm + periodic 4-min re-warm + client sessionStorage

## Key Technical Notes
- **Caching Strategy**: `_api_cache` dict in server.py with `_cache_get`/`_cache_set`/`_invalidate_games_cache` helpers. Admin mutations call `_invalidate_games_cache()` immediately.
- **GMZ Video Hash**: Extracted from `embed_url` — the hash IS the gameid for video embed.
- **Batch Video Cache**: `_gmz_batch_result` cached 30 min at batch level; `_gmz_video_cache` per-hash 1h.
- **Periodic Re-warm**: `_periodic_rewarm()` task runs every 4 min to keep cache fresh.
- **sessionStorage**: Games (30s) and video URLs (1h) cached client-side to avoid re-fetch on navigation.

## Prioritized Backlog
### P0 (Blocked)
- Enable Wallet System with Stripe (blocked on user API key)

### P1
- Featured Games section on home feed (use banner_url / logo_url)
- Import more GMZ games to have a richer feed

### P2
- Social features, notifications, custom fonts, SEO
- Re-enable Pro/Ad-Free features when ready
- Fix friends API endpoint error (TypeError: Failed to fetch on profile page)

## Key Credentials
- Admin: admin@hypd.games / admin123

## Known Limitations
- Stripe payments MOCKED/disabled
- Pro/Ad-Free features hidden (can be re-enabled later)
- GameMonetize external API may rate-limit under heavy browsing (429 responses)
- Cloudflare overrides Cache-Control headers — HTTP caching not active end-to-end; server-side memory cache is the effective layer
- Friends API endpoint has a minor fetch error (pre-existing, low priority)
