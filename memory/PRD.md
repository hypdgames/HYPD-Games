# Hypd Games - Product Requirements Document

## Original Problem Statement
Build "Hypd Games," a mobile-first instant gaming website with a vertical, "TikTok-style" endless scroll feed. React (Next.js) frontend, Python (FastAPI) backend, PostgreSQL (Supabase) database.

## Core Features Implemented
- **Game Feed**: TikTok-style vertical scroll with game cards
- **Multi-Network Game Integration**: GamePix and GameMonetize providers (both active)
- **Admin Dashboard**: Game management, network settings, bulk operations, 7 tabs (Games, GamePix, GMZ, Upload, Users, Stats, Settings)
- **Daily Login Streaks**: Track and reward consecutive daily logins
- **Consolidated Profile Page**: Refactored into child components (Streak, Games, Wallet, Friends tabs)
- **Wallet/Coin System**: Coin balance, packages (Stripe MOCKED/disabled)
- **Friends System**: Search, add, accept/decline, remove
- **Base Defence Game (Tower Defense)**: Canvas-based pixel art survival game with auto-attacking archer tower, 5 enemy types, 15 in-game upgrades, lobby with 12 permanent upgrades, 15-min survival timer, XP/gold collection, game speed toggle, victory/defeat screens. Fully responsive. State persists to backend.
- **GameMonetize Integration**: Browse, search, filter, sort, import/bulk-import games from GameMonetize feed. Embed wrapper for playback. ads.txt updated.
- **ads.txt**: Contains entries for Google AdSense, GamePix, and GameMonetize

## Hidden/Disabled Features
- **Pro/Ad-Free features**: All Pro-related UI hidden. ProTab.tsx deleted. Can be re-enabled.
- **Stripe payments**: Mocked/disabled, awaiting API key.

## Architecture
```
/app/
├── backend/
│   ├── server.py (GamePix, GameMonetize, idle game, auth, admin endpoints)
│   ├── models.py (IdleGameState model)
│   └── database.py
├── frontend/src/app/
│   ├── defence-game/ (Base Defence tower defense game)
│   ├── admin/
│   │   ├── page.tsx (Admin dashboard with 7 tabs)
│   │   └── components/
│   │       ├── GamesTab.tsx
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
- `GET /api/gamemonetize/browse` — Browse GameMonetize games (filter, search, sort, paginate)
- `GET /api/gamemonetize/categories` — GameMonetize categories
- `POST /api/admin/gamemonetize/import` — Import single game
- `POST /api/admin/gamemonetize/bulk-import` — Bulk import games
- `GET /api/gamepix/browse` — Browse GamePix games
- `POST /api/admin/gamepix/bulk-import` — Bulk import GamePix games
- `GET /api/games` — Game feed
- `GET /api/games/{id}/play` — Play game (embed wrapper for GMZ/GPX)
- `GET/POST /api/idle-game/state|save` — Defence game state

## Prioritized Backlog
### P0
- Enable Wallet System with Stripe (blocked on user API key)

### P1
- Featured Games section on home feed
- Video Previews for games

### P2
- Social features, notifications, custom fonts, SEO
- Re-enable Pro/Ad-Free features when ready

## Key Credentials
- Admin: admin@hypd.games / admin123

## Known Limitations
- Stripe payments MOCKED/disabled
- Pro/Ad-Free features hidden (can be re-enabled later)
- GameMonetize external API may rate-limit under heavy browsing (429 responses)
- Base Defence first run is challenging by design
