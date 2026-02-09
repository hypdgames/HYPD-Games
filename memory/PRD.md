# Hypd Games - Product Requirements Document

## Original Problem Statement
Build "Hypd Games," a mobile-first instant gaming website with a vertical, "TikTok-style" endless scroll feed. React (Next.js) frontend, Python (FastAPI) backend, MongoDB database.

## Core Features Implemented
- **Game Feed**: TikTok-style vertical scroll with game cards
- **Multi-Network Game Integration**: GamePix and GameMonetize providers
- **Admin Dashboard**: Game management (search, filter, sort, bulk import/delete), network settings (enable/disable providers)
- **Daily Login Streaks**: Track and reward consecutive daily logins with milestones, leaderboard, and multipliers
- **Consolidated Profile Page**: Central hub with tabs for Streak, Games (Saved), Wallet/Coins, Friends, and PRO plans
- **Wallet/Coin System**: Coin balance, packages, ad-free purchases (Stripe MOCKED/disabled)
- **Ad-Free for Pro Users (GamePix only)**: Disable ads via URL params for Pro users
- **Admin Pro Toggle**: Admin can toggle Pro status for testing
- **Friends System**: Search, add, accept/decline requests, remove friends
- **Google AdSense**: Site verification and ads.txt

## Tech Stack
- **Frontend**: Next.js 14, React, Tailwind CSS, Shadcn/UI, Zustand, Framer Motion
- **Backend**: FastAPI, Python
- **Database**: MongoDB
- **3rd Party**: GamePix, GameMonetize, Google AdSense, Stripe (disabled)

## Architecture
```
/app/
├── backend/
│   ├── server.py
│   └── models.py
├── frontend/
│   ├── src/app/
│   │   ├── admin/ (dashboard with GamesTab, GameMonetizeTab, SettingsTab)
│   │   ├── explore/
│   │   ├── play/[gameId]/ (game-player.tsx)
│   │   ├── profile/
│   │   │   ├── page.tsx (orchestrator, ~420 lines)
│   │   │   ├── layout.tsx (Suspense boundary)
│   │   │   ├── types.ts (shared interfaces)
│   │   │   └── components/
│   │   │       ├── AuthView.tsx (logged-out view)
│   │   │       ├── ProfileHeader.tsx (header + stats)
│   │   │       ├── StreakTab.tsx
│   │   │       ├── GamesTab.tsx
│   │   │       ├── FriendsTab.tsx
│   │   │       ├── WalletTab.tsx
│   │   │       ├── ProTab.tsx
│   │   │       └── AdminSection.tsx
│   │   └── wallet/ (deprecated, migrated to profile)
│   ├── src/components/ (navbar, bottom-nav, ui/)
│   └── src/store/ (auth-store, theme-store)
```

## What's Been Implemented (Latest: Feb 9, 2026)
- [x] Profile page refactored from 1913 lines into 10 smaller component files
- [x] Admin Network Settings (enable/disable GamePix/GameMonetize)
- [x] Bulk Game Management (select all, bulk delete)
- [x] GameMonetize image handling (multiple sizes)
- [x] Ad-Free for Pro Users (GamePix only)
- [x] Admin Pro Status Toggle
- [x] Wallet Page Migration to Profile tab
- [x] UI Cleanup (Coins button removed from navbar)
- [x] All bug fixes (GameMonetize import, loading, caching, images, ad-free state)

## Prioritized Backlog
### P0
- Enable Wallet System with Stripe (needs valid STRIPE_API_KEY)

### P1
- Implement "Featured Games" section on home feed
- Video Previews for games

### P2
- Social Feature Enhancements (friend challenges, game sharing)
- User Notifications
- "Flappy Bird" style custom game
- Custom fonts
- SEO meta tags customization

## Key Credentials
- Admin: admin@hypd.games / admin123

## Known Limitations
- Ad-free is GamePix ONLY (GameMonetize doesn't support publisher-side ad blocking)
- Stripe payments are MOCKED/disabled
- Wallet is in Profile page (not standalone /wallet route)
