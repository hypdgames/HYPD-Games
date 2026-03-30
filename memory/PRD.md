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
- **Explore Page**: Redesigned with horizontally-scrolling carousels — New Games, Categories, Trending, per-category rows.
- **Bottom Navbar**: Floating pill-style, supports dark/light mode.
- **Performance**: Server-side in-memory TTL caching (5min for games/categories), batch-level video URL cache (30min), startup pre-warm + periodic 4-min re-warm, sessionStorage client-side caching.

## UI/UX Redesign (Completed March 2026)
Complete visual overhaul based on "Hook" app reference:
- **Theming**: CSS variable-based light/dark mode. Dark: deep #141414 bg with glow accents. Light: #FAFAFA bg with purple gradient bleed from top.
- **Typography**: DM Sans font, lowercase bold headings, clean modern typography.
- **Colors**: #AAFF00 (neon lime) accent, #7748F8 → #A259FF (purple gradient) for CTAs, themed surfaces.
- **Components**: Floating pill bottom nav (999px radius, 64px height), squircle cards (24px radius), pill-shaped tabs, gradient CTA buttons, backdrop-blur action buttons, card-elevated surfaces.
- **Layout**: Mobile-first 430px max-width centered container.
- **Motion**: Scale-down on tap (0.97-0.85), smooth transitions on theme toggle.

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
│   └── database.py
├── frontend/
│   ├── tailwind.config.ts (Updated: DM Sans, #AAFF00 lime, squircle/pill radii)
│   └── src/
│       ├── app/
│       │   ├── globals.css (REDESIGNED: CSS variables, page-gradient, glass, squircle utilities)
│       │   ├── layout.tsx (REDESIGNED: DM Sans, 430px container)
│       │   ├── page.tsx (REDESIGNED: glassmorphic action buttons, improved overlays)
│       │   ├── explore/explore-page.tsx (REDESIGNED: gradient category tiles, squircle cards, lowercase headers)
│       │   ├── leaderboard/page.tsx (REDESIGNED: pill tabs, card-style rows, page gradient)
│       │   ├── profile/ (REDESIGNED: gradient CTA, rounded avatar, stats cards)
│       │   └── play/[gameId]/game-player.tsx (REDESIGNED: glass-dark back button)
│       └── components/
│           ├── bottom-nav.tsx (REDESIGNED: floating pill, lime active circle)
│           ├── theme-toggle.tsx (REDESIGNED: rounded muted button)
│           └── ui/ (REDESIGNED: button, input, tabs components)
└── design_guidelines.json (UI/UX rulebook)
```

## Key API Endpoints
- `GET /api/games` — Game feed/explore (cached 5min in-memory)
- `GET /api/categories` — Categories list (cached 5min)
- `GET /api/games/video-previews-batch` — Batch video URLs
- `GET /api/leaderboard/global` — Global leaderboard
- `GET /api/leaderboard/game/{gameId}` — Per-game leaderboard

## Prioritized Backlog
### P0 (Blocked)
- Enable Wallet System with Stripe (blocked on user API key)

### P1
- Featured Games section on home feed (use banner_url / logo_url)
- Import more GMZ games to have a richer feed

### P2
- Social features, notifications, SEO
- Re-enable Pro/Ad-Free features when ready
- Fix friends API endpoint error (TypeError: Failed to fetch on profile page)

## Key Credentials
- Admin: admin@hypd.games / admin123

## Known Limitations
- Stripe payments MOCKED/disabled
- Pro/Ad-Free features hidden
- GameMonetize external API may rate-limit (429)
- Friends API endpoint has a minor fetch error (pre-existing, low priority)
