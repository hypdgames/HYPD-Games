# Hypd Games - Product Requirements Document

## Original Problem Statement
Build "Hypd Games," a mobile-first instant gaming website with a vertical feed. The UI must match the "Hook" app aesthetic: card-based feed, frosted glass navigation, pink/lavender gradient backgrounds, large purple center button, pill-shaped elements, and a clean modern feel.

## UI/UX Redesign — Hook Style (Completed March 2026)
Deep structural redesign matching the Hook app reference:

### Feed Page
- Card-based layout (NOT full-screen TikTok style)
- Large rounded content card (28px radius) with centered play button overlay
- Play count badge (backdrop-blur pill) at top-right of card
- Game info at bottom of card (lime category pill, bold title, description)
- Action pills row below card: Play Now (lime), Heart, Comment (replaces Share)
- HYPD brand logo at top-left, theme toggle at top-right

### Discover/Explore Page
- "Discover" extrabold title
- Full-width pill search bar ("What are you looking for?")
- "Top Games" horizontal scroll — clean game tiles (no rank numbers, no card borders)
- "Trending" section with large squircle cards + play count badges
- "Categories" visual tiles with game screenshot backgrounds + gradient overlays + name/count overlay
- Quick-launch "Play Now" button on category tiles (hover on desktop, long-press on mobile) — launches top game from that category instantly
- "New Games" tiles
- Per-category horizontal scrolls

### Leaderboard Page
- Centered bold "Leaderboard" title
- Filter pills (All = lime active, By Game = grey bordered)
- Soft-card user rows with rank icons (crown, medals)
- Game selector pills for "By Game" mode

### Profile/Auth Page
- Centered bold "Profile" title
- Large rounded avatar (3xl radius)
- Pill-style Login/Sign Up filter tabs
- Full-width pill inputs (search-bar style)
- Purple violet CTA button with glow shadow
- Stats cards grid (Streak, Saved, Scores, Friends)

### Bottom Navigation
- Frosted glass bar (backdrop-filter blur 24px, 32px radius)
- Large purple center button (Crosshair/Defence) with glow shadow
- 5 items: Feed, Explore, Defence, Leaders, Profile

### Theming
- Light mode (DEFAULT): Pink/lavender gradient at top, white cards, grey muted surfaces
- Dark mode: Deep purple gradient at top, dark cards, dark muted surfaces
- CSS variable-based toggle — no layout shifts

### Typography & Colors
- Font: DM Sans (400-800 weights)
- Primary accent: #AAFF00 (neon lime)
- Secondary/CTA: #7748F8 (violet)
- Key CSS classes: hook-gradient-bg, frosted-nav, content-card, soft-card, filter-pill, action-pill, search-bar, play-badge

## Core Features
- Multi-network game integration (GamePix, GameMonetize)
- Admin dashboard with 7 tabs
- Daily login streaks & coin system
- Friends system (search, add, accept, remove)
- Base Defence tower defense game
- Performance caching (backend TTL + frontend sessionStorage)
- Automatic cache invalidation on admin game imports
- **Game Comments**: Players can comment on any game via bottom-sheet (GET/POST/DELETE `/api/games/{id}/comments`); comment count badge on feed button
- **Like Count**: `like_count` column on `games` table; increments on save, decrements on unsave; shown as badge on heart button with optimistic updates
- **Welcome/Splash Page** (`/welcome`): Shows on first visit or when not logged in. Vertical auto-scrolling game thumbnail slideshow (1.5s), Login/Sign Up bottom-sheet forms, Play as Guest (sets `sessionStorage hypd:guest`). Feed auth-gates to `/welcome` for unauthenticated non-guest users.

## Architecture
```
/app/
├── backend/
│   ├── server.py, cache.py, database.py, models.py
├── frontend/
│   ├── tailwind.config.ts (DM Sans, lime/violet colors, squircle/pill radii)
│   └── src/
│       ├── app/
│       │   ├── globals.css (Hook CSS system)
│       │   ├── layout.tsx (DM Sans, 430px container)
│       │   ├── page.tsx (Card-based feed)
│       │   ├── explore/ (Hook Discover page)
│       │   ├── leaderboard/ (Activity-style)
│       │   └── profile/ (Centered titles, pill auth)
│       ├── components/
│       │   ├── bottom-nav.tsx (Frosted glass + purple center)
│       │   └── theme-toggle.tsx
│       └── store/theme-store.ts (Light mode default)
└── design_guidelines.json
```

## Prioritized Backlog
### P0 (Blocked)
- Stripe wallet (waiting on API key)

### P1
- Featured Games section on home feed
- Import more GMZ games

### P2
- Social features, notifications, SEO
- Fix friends API fetch error
- Re-enable Pro/Ad-Free features
- Real-time comment count in feed already DONE (Feb 2026)

## Critical Infrastructure Note
**Frontend runs `next start` (production build mode) — NOT hot reload.**
After any source code changes, you MUST run:
```
cd /app/frontend && yarn build
sudo supervisorctl restart frontend
```
Then wait ~2 min for the build to complete before testing. The testing agent confirmed this on Apr 11 2026.


- CommentSheet z-index + padding fix (Login/Sign Up buttons fully visible above nav) — Apr 2026
- HTML entity decoding in game titles (decodeHtml util in page.tsx) — Apr 2026
- Categories in Explore derived dynamically from games list (no separate /api/categories call) — Apr 2026
- **Performance Optimization** — Apr 2026:
  - Backend: `comment-counts` cache TTL increased 60s → 300s; `Cache-Control: public, max-age=300, stale-while-revalidate=600` header added to `/api/games/comment-counts`
  - Frontend: `FeedCard` wrapped with `React.memo` to prevent re-renders during scroll
  - Frontend: `categoriesWithGames`, `trending`, `newGames`, `searchResults` memoized with `useMemo` in explore page
  - Frontend: CDN preconnect hints and Welcome hero image `priority` were already present
- **Security Hardening (RLS)** — Apr 2026:
  - Enabled Row-Level Security (RLS) on all 18 Supabase tables
  - Added 8 RLS policies with least-privilege access:
    - PUBLIC READ: `games` (visible only), `app_settings`, `coin_packages` (active only), `game_comments`, `comment_likes`
    - AUTHENTICATED OWN-DATA: `users` (own row), `wallet_transactions` (own), `play_sessions` (own)
    - NO PostgREST writes on any table — all writes via FastAPI (validated + rate-limited)
  - Updated JWT to include `role: "authenticated"` + `iss: "hypd-games"` claims
  - FastAPI backend unaffected (superuser bypasses RLS)
  - Per-user policies activate once Supabase JWT secret = `hypd-games-prod-secret-key-xK9mP2nQ7vL4wR8t` in Dashboard → Project Settings → API → JWT Settings
  - Scripts: `/app/backend/scripts/enable_rls.py`, `/app/backend/scripts/apply_rls_policies.py`
- **GMZ Walkthrough Video Ads** — Apr 2026:
  - Admin toggle in GameMonetize tab: "Walkthrough Video Ads" ON/OFF switch (stored in `app_settings.gmz_video_ads_enabled`)
  - "Watch Walkthrough" button in game play toolbar for all GMZ games — opens official GameMonetize video.js player in full-screen sheet
  - Player uses `window.VIDEO_OPTIONS` with `getAds: "true"/"false"` based on admin setting
  - Revenue earned automatically by domain when ads ON (per GMZ docs — no publisher ID needed)
  - Testing: 13/13 backend + 10/10 frontend flows passed

## Critical Infrastructure Note
**Frontend runs `next start` (production build mode) — NOT hot reload.**
After any source code changes, run: `cd /app/frontend && yarn build && sudo supervisorctl restart frontend`
- Admin: admin@hypd.games / admin123
