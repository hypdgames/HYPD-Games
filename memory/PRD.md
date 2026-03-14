# Hypd Games - Product Requirements Document

## Original Problem Statement
Build "Hypd Games," a mobile-first instant gaming website with a vertical, "TikTok-style" endless scroll feed. React (Next.js) frontend, Python (FastAPI) backend, PostgreSQL (Supabase) database.

## Core Features Implemented
- **Game Feed (Redesigned)**: Full-screen TikTok-style vertical scroll with GMZ video previews, Play Now button overlay, game info at bottom, Save/Share side buttons, swipe navigation
- **GameMonetize Video Previews**: Automatically derives `gameid` hash from `embed_url` for video embed. Uses `srcdoc` iframe per card to avoid `window.VIDEO_OPTIONS` global conflicts between cards. Lazy loads — only active card shows video.
- **Admin Feed Toggle**: New `show_in_feed` boolean field on games. Toggle button (TvMinimalPlay icon) in admin GamesTab to add/remove game from main feed while keeping it searchable in Explore. Badge "Explore only" shown in admin when hidden from feed.
- **Multi-Network Game Integration**: GamePix and GameMonetize providers (both active)
- **Admin Dashboard**: Game management, network settings, bulk operations, 7 tabs (Games, GamePix, GMZ, Upload, Users, Stats, Settings)
- **Daily Login Streaks**: Track and reward consecutive daily logins
- **Consolidated Profile Page**: Refactored into child components (Streak, Games, Wallet, Friends tabs)
- **Wallet/Coin System**: Coin balance, packages (Stripe MOCKED/disabled)
- **Friends System**: Search, add, accept/decline, remove
- **Base Defence Game (Tower Defense)**: Canvas-based pixel art survival game
- **GameMonetize Integration**: Browse, search, filter, sort, import/bulk-import games. Embed wrapper for playback. ads.txt updated.
- **ads.txt**: Contains entries for Google AdSense, GamePix, and GameMonetize

## Hidden/Disabled Features
- **Pro/Ad-Free features**: All Pro-related UI hidden. ProTab.tsx deleted. Can be re-enabled.
- **Stripe payments**: Mocked/disabled, awaiting API key.

## Architecture
```
/app/
├── backend/
│   ├── server.py (GamePix, GameMonetize, idle game, auth, admin endpoints)
│   ├── models.py (Game.show_in_feed column added)
│   ├── alembic/versions/a1b2c3d4e5f6_add_show_in_feed_to_games.py
│   └── database.py
├── frontend/src/app/
│   ├── page.tsx (REDESIGNED: full-screen video feed)
│   ├── defence-game/ (Base Defence tower defense game)
│   ├── admin/
│   │   ├── page.tsx (Admin dashboard with 7 tabs + toggleFeedVisibility)
│   │   └── components/
│   │       ├── GamesTab.tsx (UPDATED: feed toggle button)
│   │       ├── GamePixTab.tsx
│   │       ├── GameMonetizeTab.tsx
│   │       ├── UploadTab.tsx
│   │       ├── UsersTab.tsx
│   │       ├── AnalyticsTab.tsx
│   │       ├── SettingsTab.tsx
│   │       ├── types.ts
│   │       └── index.ts
│   ├── profile/ (child components, AdminSection link)
│   └── ...
├── frontend/public/ads.txt (AdSense + GamePix + GameMonetize)
```

## Key API Endpoints
- `GET /api/games` — Game feed (filters `show_in_feed=True AND is_visible=True`)
- `PATCH /api/admin/games/{id}/feed-visibility` — Toggle feed vs explore-only
- `PATCH /api/admin/games/{id}/visibility` — Toggle full visibility on/off
- `GET /api/gamemonetize/browse` — Browse GameMonetize games (filter, search, sort, paginate)
- `GET /api/gamemonetize/categories` — GameMonetize categories
- `POST /api/admin/gamemonetize/import` — Import single game
- `POST /api/admin/gamemonetize/bulk-import` — Bulk import games
- `GET /api/gamepix/browse` — Browse GamePix games
- `POST /api/admin/gamepix/bulk-import` — Bulk import GamePix games
- `GET /api/games/{id}/play` — Play game (embed wrapper for GMZ/GPX)
- `GET/POST /api/idle-game/state|save` — Defence game state

## Key Technical Notes
- **GMZ Video Hash**: Extracted from `embed_url` (e.g. `https://html5.gamemonetize.co/{hash}/`) - this hash IS the `gameid` for the video embed. No extra API calls needed.
- **srcdoc Iframe**: Each video card uses a self-contained HTML document in the iframe's `srcdoc` attribute. This gives each card its own `window` context so `window.VIDEO_OPTIONS` doesn't conflict across multiple cards.
- **Lazy Loading**: Video iframe only created when `isActive === true` (card in viewport). Prevents loading all videos at once.

## Prioritized Backlog
### P0
- Enable Wallet System with Stripe (blocked on user API key)

### P1
- Featured Games section on home feed (use banner_url / logo_url)
- Import more GMZ games to have a richer feed

### P2
- Social features, notifications, custom fonts, SEO
- Re-enable Pro/Ad-Free features when ready

## Key Credentials
- Admin: admin@hypd.games / admin123

## Known Limitations
- Stripe payments MOCKED/disabled
- Pro/Ad-Free features hidden (can be re-enabled later)
- GameMonetize external API may rate-limit under heavy browsing (429 responses)
- Video previews only available for GameMonetize games (GPX/custom games show thumbnail background)
