# Hypd Games - Product Requirements Document

## Project Overview
**Project Name:** Hypd Games  
**Core Concept:** A mobile-first instant gaming website featuring a TikTok-style endless scroll feed where users swipe through game previews and tap to play instantly.

## Technology Stack (Updated Jan 2025)

### ✅ Frontend (MIGRATED)
- **Framework:** Next.js 14 + TypeScript (migrated from React CRA)
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion
- **Feed Virtualization:** TanStack Virtual + react-use-gesture
- **State Management:** Zustand
- **UI Components:** Radix UI + shadcn/ui
- **PWA:** Service Worker + Web App Manifest

### ✅ Backend (MIGRATED TO SUPABASE)
- **Framework:** FastAPI (Python)
- **Database:** PostgreSQL via Supabase
- **ORM:** SQLAlchemy with async support
- **Migrations:** Alembic
- **Auth:** JWT (PyJWT) - custom implementation
- **File Storage:** ✅ Supabase Storage (games, game-thumbnails, game-previews buckets)

### ⏳ Planned Integrations
- **GameDistribution SDK:** For game library and ad monetization
- **Cloudinary:** For video preview optimization (optional)
- **Redis:** For feed caching at scale (optional)

---

## Implemented Features

### Phase 1: Core Platform ✅
- [x] TikTok-style vertical game feed with snap scrolling
- [x] TanStack Virtual for performance (only renders visible items)
- [x] react-use-gesture for swipe mechanics
- [x] Full-screen game player with draggable back button
- [x] 4-tab navigation: Feed, Explore, PRO, Profile
- [x] JWT authentication (login/register)
- [x] Admin Dashboard with game management

### Phase 2: UX Enhancements ✅
- [x] Auto/Light/Dark theme system with persistence
- [x] PWA manifest for standalone mode
- [x] Mobile-optimized responsive design
- [x] Game save functionality
- [x] Play count tracking
- [x] Share functionality (Web Share API)

### Phase 3: Admin Features ✅
- [x] Game upload with progress indicator
- [x] Game visibility toggle
- [x] Game deletion
- [x] Basic analytics (plays, games count)
- [x] Support for 3 preview types: video, gif, image

### Phase 4: Performance & SEO ✅
- [x] Service Worker for caching and offline support
- [x] Game Pre-caching - Next 2 games are pre-cached as user scrolls
- [x] SEO Meta Tags - Dynamic titles, descriptions, Open Graph for all pages
- [x] HTTP Cache Headers - 60s cache for games list, 5min for game meta
- [x] Twitter Cards - summary_large_image for game sharing
- [x] Dynamic sitemap.xml and robots.txt

### Phase 5: Supabase Storage Integration ✅ (COMPLETED)
- [x] Migrated game file storage to Supabase Storage
- [x] Automatic bucket creation on startup (games, game-thumbnails, game-previews)
- [x] Game uploads store thumbnails and HTML to Supabase
- [x] Play endpoint serves game HTML directly (avoids CSP issues)
- [x] Thumbnails served from Supabase public URLs
- [x] Full test coverage with pytest (14/14 tests passing)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js 14)                   │
│  Pages: /, /explore, /pro, /profile, /admin, /play/[id]    │
│  Components: BottomNav, ThemeToggle, GameCard, etc.         │
│  State: Zustand (auth-store, theme-store)                   │
│  PWA: Service Worker (sw.js) + manifest.json                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND (FastAPI)                         │
│  /api/auth/* - Authentication                               │
│  /api/games/* - Game CRUD + Meta endpoint                   │
│  /api/admin/* - Admin endpoints + File upload               │
│  /api/analytics/* - Play tracking                           │
│  Cache Headers: 60s games, 300s meta                        │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
┌─────────────────────────┐             ┌─────────────────────────┐
│   SUPABASE POSTGRESQL   │             │   SUPABASE STORAGE      │
│   Tables: users, games  │             │   Buckets:              │
│   play_sessions,        │             │   - games               │
│   app_settings          │             │   - game-thumbnails     │
└─────────────────────────┘             │   - game-previews       │
                                        └─────────────────────────┘
```

---

## File Structure

```
/app/
├── backend/
│   ├── server.py           # FastAPI app + Supabase Storage
│   ├── database.py         # SQLAlchemy async setup
│   ├── models.py           # User, Game, PlaySession models
│   ├── alembic/            # Database migrations
│   ├── requirements.txt
│   └── .env                # Supabase credentials
├── frontend/               # Next.js 14 + TypeScript
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx           # TikTok-style feed
│   │   │   ├── explore/
│   │   │   ├── pro/
│   │   │   ├── profile/page.tsx
│   │   │   ├── admin/page.tsx
│   │   │   └── play/[gameId]/
│   │   │       ├── page.tsx       # Dynamic SEO
│   │   │       └── game-player.tsx
│   │   ├── components/
│   │   │   ├── bottom-nav.tsx
│   │   │   ├── theme-toggle.tsx
│   │   │   ├── providers.tsx
│   │   │   ├── service-worker.tsx
│   │   │   └── ui/
│   │   ├── store/
│   │   └── lib/
│   └── public/
└── tests/
    └── test_supabase_storage.py    # Backend API tests
```

---

## Upcoming Tasks (Prioritized)

### P1 - High Priority
1. **GameDistribution Integration**
   - Research GameDistribution SDK
   - Implement game catalog import
   - Set up ad placements and revenue tracking

### P2 - Medium Priority
2. **Video Preview Support (Cloudinary)**
   - Add video upload support to admin
   - Implement video optimization pipeline
   - Support video/gif/image preview types

3. **Ad System**
   - Feed interstitial ads (every 5-8 games)
   - In-game rewarded ads API
   - Google Ad Manager integration

### P3 - Low Priority (Nice to Have)
4. **Redis Caching**
   - Add Redis for feed caching at scale
   - Session management

5. **Social Features**
   - Friend challenges
   - Game sharing with deep links
   - Leaderboards

---

## Test Credentials
- **Admin:** admin@hypd.games / admin123

---

## Changelog

### January 18, 2025 (Session 4 - SUPABASE STORAGE COMPLETE)
- **MAJOR:** Completed Supabase Storage integration for game files
- **Added:** Automatic storage bucket creation (games, game-thumbnails, game-previews)
- **Added:** Upload endpoint saves thumbnails and game HTML to Supabase Storage
- **Added:** Play endpoint downloads and serves game content directly (avoids CSP issues)
- **Added:** Comprehensive pytest test suite (14/14 tests passing)
- **Fixed:** Logger initialization order bug in server.py
- **Fixed:** Bucket creation API parameters for supabase-py
- **Tested:** Full game upload and play flow verified working

### January 18, 2025 (Session 3 - SUPABASE MIGRATION)
- **MAJOR:** Migrated database from MongoDB to PostgreSQL/Supabase
- **Added:** SQLAlchemy ORM with async support
- **Added:** Alembic for database migrations
- **Created:** New database schema (users, games, play_sessions, app_settings)
- **Updated:** All backend endpoints to use PostgreSQL

### January 18, 2025 (Session 2)
- **Added:** Service Worker for caching and offline support
- **Added:** Game pre-caching (next 2 games as user scrolls)
- **Added:** Dynamic SEO meta tags for all pages
- **Added:** Dynamic sitemap.xml and robots.txt

### January 18, 2025 (Session 1)
- **MAJOR:** Migrated frontend from React (CRA) to Next.js 14 + TypeScript
- **MAJOR:** Implemented TanStack Virtual for virtualized feed
- **MAJOR:** Added react-use-gesture for swipe mechanics
