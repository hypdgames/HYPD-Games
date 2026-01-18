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

### ✅ Backend (Current)
- **Framework:** FastAPI (Python)
- **Database:** MongoDB
- **File Storage:** GridFS (to be migrated to CDN)
- **Auth:** JWT (PyJWT)
- **Caching:** HTTP Cache headers

### ⏳ Planned Migrations
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions)
- **Storage:** Cloudflare R2 + CDN

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

### Phase 4: Performance & SEO ✅ (NEW)
- [x] **Service Worker** for caching and offline support
- [x] **Game Pre-caching** - Next 2 games are pre-cached as user scrolls
- [x] **SEO Meta Tags** - Dynamic titles, descriptions, Open Graph for all pages
- [x] **HTTP Cache Headers** - 60s cache for games list, 5min for game meta
- [x] **Twitter Cards** - summary_large_image for game sharing

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js 14)                   │
│  Pages: /, /explore, /pro, /profile, /admin, /play/[id]    │
│  Components: BottomNav, ThemeToggle, GameCard, etc.         │
│  State: Zustand (auth-store, theme-store)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND (FastAPI)                         │
│  /api/auth/* - Authentication                               │
│  /api/games/* - Game CRUD                                   │
│  /api/admin/* - Admin endpoints                             │
│  /api/analytics/* - Play tracking                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   DATABASE (MongoDB)                        │
│  Collections: users, games, analytics, fs.files, fs.chunks  │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure (Updated)

```
/app/
├── backend/
│   ├── server.py           # FastAPI app
│   ├── requirements.txt
│   └── .env
├── frontend/               # Next.js 14 + TypeScript
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx           # TikTok-style feed
│   │   │   ├── explore/page.tsx
│   │   │   ├── pro/page.tsx
│   │   │   ├── profile/page.tsx
│   │   │   ├── admin/page.tsx
│   │   │   └── play/[gameId]/page.tsx
│   │   ├── components/
│   │   │   ├── bottom-nav.tsx
│   │   │   ├── theme-toggle.tsx
│   │   │   ├── providers.tsx
│   │   │   └── ui/
│   │   ├── store/
│   │   │   ├── auth-store.ts
│   │   │   └── theme-store.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── lib/
│   │       └── utils.ts
│   ├── public/
│   │   └── manifest.json
│   ├── tailwind.config.ts
│   └── package.json
└── games/
    └── flappy-frenzy/
```

---

## Upcoming Tasks (Prioritized)

### P0 - Critical
1. **Backend Migration to Supabase**
   - Set up Supabase project
   - Migrate PostgreSQL schema
   - Migrate authentication
   - Update frontend API calls

### P1 - High Priority
2. **CDN Integration (Cloudflare R2)**
   - Move game files from GridFS to R2
   - Set up signed URLs for secure downloads
   - Implement video preview support

3. **GameDistribution Integration**
   - Research GameDistribution SDK
   - Implement ad placements
   - Set up revenue tracking

### P2 - Medium Priority
4. **Ad System**
   - Feed interstitial ads (every 5-8 games)
   - In-game rewarded ads API
   - Google Ad Manager integration

5. **SEO Improvements**
   - Dynamic meta tags for game pages
   - Open Graph images
   - Sitemap generation

### P3 - Low Priority
6. **Performance Optimization**
   - Redis caching for feed
   - Image/video optimization pipeline
   - Service worker for game pre-caching

---

## Test Credentials
- **Admin:** admin@hypd.games / admin123

---

## Changelog

### January 18, 2025
- **MAJOR:** Migrated frontend from React (CRA) to Next.js 14 + TypeScript
- **MAJOR:** Implemented TanStack Virtual for virtualized feed
- **MAJOR:** Added react-use-gesture for swipe mechanics
- **Added:** PWA manifest for standalone mode
- **Added:** Zustand for state management
- **Updated:** All pages to use Next.js App Router
- **Updated:** Design system preserved (lime accent, glassmorphism, etc.)
- **Tested:** All core flows working (feed, explore, profile, admin)

### Previous Session
- Created Flappy Frenzy game with pixel art style
- Added file upload progress indicators
- Implemented Auto theme option
- Added analytics features (retention, cohorts, export)
- Created Docker deployment package
