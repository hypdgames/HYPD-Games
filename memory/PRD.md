# Hypd Games - Product Requirements Document

## Project Overview
**Project Name:** Hypd Games  
**Live URL:** https://hypd.games  
**Backend API:** https://hypd-games-production.up.railway.app  
**Core Concept:** A mobile-first instant gaming website featuring a TikTok-style endless scroll feed where users swipe through game previews and tap to play instantly.

---

## Technology Stack

### Frontend (Vercel)
- **Framework:** Next.js 14 + TypeScript
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion
- **Feed Virtualization:** TanStack Virtual + react-use-gesture
- **State Management:** Zustand
- **UI Components:** Radix UI + shadcn/ui
- **Charts:** Recharts (for analytics)
- **PWA:** Service Worker + Web App Manifest

### Backend (Railway)
- **Framework:** FastAPI (Python)
- **Database:** PostgreSQL via Supabase
- **ORM:** SQLAlchemy with async support
- **Migrations:** Alembic
- **Auth:** JWT (PyJWT)
- **File Storage:** Supabase Storage
- **Caching:** Redis (Railway)

### Integrations
- ✅ **Supabase:** Database + Storage
- ✅ **Redis:** Caching (hosted on Railway)
- ✅ **GamePix:** Real game integration via RSS feed (sid=1M9DD) - LIVE
- ✅ **Google AdSense:** Site ownership verified
- ⏳ **GamePix Ads SDK:** Pending GamePix approval
- ⏳ **Cloudinary:** For video previews (planned)

---

## Implemented Features

### Core Platform ✅
- [x] TikTok-style vertical game feed with snap scrolling
- [x] TanStack Virtual for performance
- [x] Full-screen game player with draggable back button
- [x] 5-tab navigation: Feed, Explore, Challenges, Leaders, Profile
- [x] JWT authentication (login/register)
- [x] Admin Dashboard with game management

### GamePix Integration ✅ (NEW - January 19, 2026)
- [x] **Browse GamePix Games** via RSS feed
  - Category filtering (20+ categories)
  - Pagination support (12, 24, 48, 96 games per page)
  - Quality score display
- [x] **Import Games from GamePix**
  - Single game import from admin dashboard
  - Bulk import with duplicate detection
  - Games stored with source='gamepix' and gd_game_id='gpx-{namespace}'
- [x] **Play GamePix Games**
  - HTML embed wrapper with iframe
  - Includes publisher SID for stats tracking
  - Play count incrementing
- [x] **Admin Dashboard GamePix Tab**
  - Browse games by category
  - Select and import multiple games
  - Load more pagination

### Admin Features ✅
- [x] Game upload (ZIP + thumbnail)
- [x] Game visibility toggle
- [x] Game deletion
- [x] GamePix import (LIVE)
- [x] GameDistribution import (mock - deprecated)
- [x] **Enhanced Analytics Dashboard with charts:**
  - Overview cards (Total Users, Games, Plays, Active 24h)
  - Daily Activity Area Chart (14 days)
  - Plays by Category Pie Chart
  - User Retention Bar Chart
  - Top Games by Plays List
  - Geographic Region Distribution

### Social Features ✅ (January 19, 2025)
- [x] **Leaderboard Page** (`/leaderboard`)
  - Global leaderboard with user rankings
  - Per-game leaderboards with game selector
  - Shows games played and play time
- [x] **Friends System** (`/profile` Friends tab)
  - User search with debouncing
  - Send friend requests
  - Accept/decline friend requests
  - View friends list with stats
  - Remove friends
- [x] **Challenges UI** (`/challenges`)
  - Active challenges list
  - Challenge progress tracking
  - Join challenge functionality
  - Points/rewards display

### Daily Login Streak ✅ (January 25, 2026)
- [x] **Streak Backend Logic**
  - Streak calculation on login (consecutive days increment, missed day resets to 1)
  - Bonus points based on streak length with multiplier system
  - Best streak tracking
- [x] **Streak API Endpoints**
  - `/api/user/streak` - Authenticated user's streak data
  - `/api/user/streak/leaderboard` - Public top streakers
- [x] **Streak Frontend UI**
  - Streak tab on Profile page with hero card
  - Progress bar to next milestone
  - Stats grid (Best, Points, Days, Multiplier)
  - Milestones badges (7, 14, 30, 60, 90, 180, 365 days)
  - Top Streakers leaderboard

### SEO & Performance ✅
- [x] Dynamic sitemap.xml
- [x] robots.txt
- [x] Open Graph image for social sharing
- [x] Service Worker for caching
- [x] Game pre-caching
- [x] HTTP Cache headers

### Monetization (Ready) ✅
- [x] ads.txt configured for GameDistribution

---

## Test Results (January 19, 2025)

| Category | Result |
|----------|--------|
| Backend API | 15/15 social feature tests passed (100%) |
| Frontend UI | All new features verified |
| Previous Tests | 34/34 tests passed (100%) |

---

## Upcoming Tasks

### P0 - Awaiting External
1. **Real GameDistribution Integration** - Waiting for publisher approval (Publisher ID/API Key)

### P1 - High Priority
2. **Featured Games Section** - Highlight top-quality GamePix games on home feed (based on quality_score)
3. **Video Previews** - Cloudinary integration for game preview videos
4. **Ad System** - Feed interstitial ads with GamePix SDK (pending approval)

### P2 - Medium Priority
5. **Friend-to-Friend Challenges** - Challenge friends to beat their scores
6. **Game Sharing** - Share games with friends via link
7. **User Notifications** - In-app notifications system
8. **Custom Fonts** - Admin font customization
9. **SEO Meta Tags** - Admin-configurable SEO settings

---

## Credentials
- **Admin:** admin@hypd.games / admin123

---

## Key API Endpoints

### Social Features
- `GET /api/leaderboard/global` - Global user rankings
- `GET /api/leaderboard/game/{game_id}` - Per-game leaderboard
- `POST /api/leaderboard/submit` - Submit a score
- `GET /api/users/search?q={query}` - Search users (auth required)
- `GET /api/friends` - Get friends list
- `GET /api/friends/requests` - Get pending friend requests
- `POST /api/friends/request` - Send friend request
- `POST /api/friends/accept/{request_id}` - Accept friend request
- `POST /api/friends/decline/{request_id}` - Decline friend request
- `DELETE /api/friends/{friend_id}` - Remove friend
- `GET /api/challenges` - Get active challenges
- `POST /api/challenges/{id}/join` - Join a challenge

### Admin Analytics
- `GET /api/admin/analytics/overview` - Stats overview with categories and top games
- `GET /api/admin/analytics/daily?days=14` - Daily activity stats
- `GET /api/admin/analytics/retention` - User retention data (Day 1, 3, 7)

---

## Changelog

### January 25, 2026 - Daily Login Streak Feature
- **IMPLEMENTED:** Complete Daily Login Streak system for user engagement
  - **Backend Logic:**
    - Login endpoint now calculates and updates user streak on successful login
    - First login starts streak at 1 day + 10 points
    - Consecutive daily logins increment streak with bonus points (multiplier-based)
    - Missing a day resets streak to 1 (total login days preserved)
    - Points scale: Day 1-7: 10×day, Day 8-30: 100+15×(day-7), Day 31+: 500+20×(day-30)
  - **New API Endpoints:**
    - `GET /api/user/streak` - Returns detailed streak info (current, best, points, milestones, multiplier)
    - `GET /api/user/streak/leaderboard` - Public leaderboard of top streakers
  - **Frontend UI:**
    - New Streak tab added to Profile page (first tab in 4-tab layout)
    - Hero card with animated flame icon, current streak count, active/inactive status
    - Progress bar showing days until next milestone (7, 14, 30, 60, 90, 180, 365)
    - Stats grid: Best Streak, Streak Points, Total Days, Multiplier
    - Milestones section with achievement badges
    - Top Streakers leaderboard with current user highlighted
    - "How Streaks Work" info section
  - **Database Fields:** `login_streak`, `best_login_streak`, `last_login_date`, `total_login_days`, `streak_points` on User model
- **TEST RESULTS:** 100% pass rate (8/8 backend tests, all frontend UI verified)

### January 21, 2026 - Security Audit & Fixes
- **SECURITY AUDIT:** Comprehensive review of all 10 OWASP security categories
- **IMPLEMENTED:**
  1. **Rate Limiting** - Auth endpoints limited to 10 requests/minute per IP
  2. **Password Strength Validation** - Min 8 chars, uppercase, lowercase, number required
  3. **Security Logging** - All auth events logged with IP addresses
  4. **Error Message Sanitization** - Internal errors no longer expose stack traces
  5. **Banned User Login Block** - Banned users receive 403 on login attempt
  6. **Admin Action Logging** - Ban/unban actions logged with admin ID
- **DOCUMENTATION:** Created `/app/memory/SECURITY_AUDIT.md` with full findings
- **REMAINING:** CORS configuration should be restricted in production

### January 21, 2026 - Admin Dashboard Refactoring & Testing
- **REFACTORED:** Admin Dashboard (`/app/frontend/src/app/admin/page.tsx`)
  - Reduced from 2,405 lines to 581 lines (76% reduction in main file)
  - Split into 6 modular components in `/app/frontend/src/app/admin/components/`:
    - `GamesTab.tsx` (95 lines) - Game list management
    - `GamePixTab.tsx` (182 lines) - GamePix import functionality
    - `UploadTab.tsx` (260 lines) - Game upload form
    - `UsersTab.tsx` (341 lines) - User management with modal
    - `AnalyticsTab.tsx` (556 lines) - Charts and statistics
    - `SettingsTab.tsx` (470 lines) - Site settings
    - `types.ts` (99 lines) - Shared TypeScript interfaces
    - `index.ts` (7 lines) - Module exports
- **TESTED:** User Management UI end-to-end
  - Backend: 100% (18/18 API tests passed)
  - Frontend: 100% (All UI features verified)
  - Full CRUD operations, ban/unban, make/remove admin
  - Search, filters, pagination all working
- **ADDED:** Comprehensive test file `/app/tests/test_user_management.py`
- **ADDED:** data-testid attributes to UsersTab component for better test automation
- **FIXED:** Light mode background pattern visibility
  - Increased opacity from 8% to 15%
  - Changed color from #557700 to #336600 for better contrast
- **FIXED:** Session persistence on page refresh
  - Auth store now persists both `token` AND `user` object to localStorage
  - Admin page now waits for `authLoading` state before checking permissions
  - Page refresh on /admin no longer redirects to /profile

### January 19, 2026 - Client-Side Navigation Bug Fix & ESLint Config
- **FIXED:** Critical client-side crash when switching tabs (P0)
  - Root cause: DOM manipulation in SettingsProvider conflicting with React's virtual DOM
  - Fixed SettingsProvider to use React refs instead of direct DOM removal
  - Simplified Providers component to use Zustand getState() pattern
- **FIXED:** ESLint TypeScript configuration (P2 - recurring issue)
  - Updated `.eslintrc.json` with proper rules configuration
  - Disabled `no-img-element` rule (external game images don't work with next/image)
  - Fixed React hooks exhaustive-deps warnings in `page.tsx` and `pro/page.tsx`
  - Added `useCallback` wrappers for fetch functions
- **TESTED:** All tabs navigate without errors, `yarn lint` passes with 0 warnings

### January 19, 2025 - Social Features & Analytics UI
- **ADDED:** Leaderboard page with Global and Per-Game tabs
- **ADDED:** Friends system on Profile page (search, request, accept, list)
- **ADDED:** Challenges UI on PRO page
- **ADDED:** Enhanced Admin Analytics dashboard with Recharts:
  - Daily Activity Area Chart
  - Plays by Category Pie Chart
  - User Retention Bar Chart
  - Top Games List
- **ADDED:** User search API endpoint (`/api/users/search`)
- **ADDED:** Progress UI component
- **INSTALLED:** recharts, @radix-ui/react-progress
- **TESTED:** 15/15 social feature tests passing
- **TESTED:** All frontend features verified

### January 18, 2025 - Production Deployment & Optimization
- **DEPLOYED:** Site live at https://hypd.games
- **DEPLOYED:** Backend on Railway
- **DEPLOYED:** Frontend on Vercel
- **FIXED:** Python linting issues (bare except, equality comparisons)
- **ADDED:** OG image for social sharing
- **UPDATED:** sitemap.ts and robots.ts with production URLs
- **ADDED:** ads.txt for GameDistribution ad monetization
- **TESTED:** 34/34 backend tests passing
- **TESTED:** All frontend features verified

### Previous Sessions
- Full-stack migration to Next.js + Supabase
- GameDistribution mock integration
- Supabase Storage for game files
- PWA and Service Worker implementation
- Redis caching on Railway
