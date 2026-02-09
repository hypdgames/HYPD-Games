# Hypd Games - Product Requirements Document

## Original Problem Statement
Build "Hypd Games," a mobile-first instant gaming website with a vertical, "TikTok-style" endless scroll feed. React (Next.js) frontend, Python (FastAPI) backend, PostgreSQL (Supabase) database.

## Core Features Implemented
- **Game Feed**: TikTok-style vertical scroll with game cards
- **Multi-Network Game Integration**: GamePix and GameMonetize providers
- **Admin Dashboard**: Game management (search, filter, sort, bulk import/delete), network settings
- **Daily Login Streaks**: Track and reward consecutive daily logins
- **Consolidated Profile Page**: Tabs for Streak, Games, Wallet/Coins, Friends, PRO plans (refactored to child components)
- **Wallet/Coin System**: Coin balance, packages, ad-free purchases (Stripe MOCKED/disabled)
- **Ad-Free for Pro Users (GamePix only)**: Disable ads via URL params
- **Admin Pro Toggle**: Admin can toggle Pro status for testing
- **Friends System**: Search, add, accept/decline requests, remove friends
- **Google AdSense**: Site verification and ads.txt
- **Pet Idle Game**: Merge idle game with 50 animal tiers, buy/merge mechanics, CPS system, prestige, offline earnings, localStorage + backend persistence

## Tech Stack
- **Frontend**: Next.js 14, React, Tailwind CSS, Shadcn/UI, Zustand, Framer Motion
- **Backend**: FastAPI, Python, SQLAlchemy (async)
- **Database**: PostgreSQL via Supabase
- **3rd Party**: GamePix, GameMonetize, Google AdSense, Stripe (disabled)

## Architecture
```
/app/
├── backend/
│   ├── server.py
│   ├── models.py (includes IdleGameState model)
│   └── database.py
├── frontend/
│   ├── src/app/
│   │   ├── admin/ (dashboard with GamesTab, GameMonetizeTab, SettingsTab)
│   │   ├── explore/
│   │   ├── idle-game/
│   │   │   ├── page.tsx (main game page)
│   │   │   ├── components/
│   │   │   │   ├── GameGrid.tsx (4x5 grid with animal slots)
│   │   │   │   ├── GameHeader.tsx (coin + CPS display)
│   │   │   │   └── ShopPanel.tsx (buy, upgrades, prestige)
│   │   │   ├── data/
│   │   │   │   └── animals.ts (50 animal tiers, images, CPS values)
│   │   │   └── hooks/
│   │   │       └── useGameState.ts (game state management)
│   │   ├── play/[gameId]/ (game-player.tsx)
│   │   ├── profile/
│   │   │   ├── page.tsx (orchestrator ~420 lines)
│   │   │   ├── layout.tsx
│   │   │   ├── types.ts
│   │   │   └── components/ (AuthView, ProfileHeader, StreakTab, GamesTab, FriendsTab, WalletTab, ProTab, AdminSection)
│   │   └── wallet/ (deprecated)
│   ├── src/components/ (navbar, bottom-nav with center Pet Idle icon, ui/)
│   └── src/store/ (auth-store, theme-store)
```

## Latest Implemented (Feb 9, 2026)
- [x] Pet Idle Game - Full merge idle game with 50 animal tiers
- [x] Generated character images for tiers 1-12 (higher tiers use emoji fallback)
- [x] Game mechanics: buy, merge, CPS earning, upgrades, prestige
- [x] Center paw icon in bottom navigation for Pet Idle
- [x] Backend save/load API for logged-in users
- [x] localStorage persistence for guest users
- [x] Offline earnings (50% rate)
- [x] Profile page refactored from 1913 lines into 10 component files

## Prioritized Backlog
### P0
- Enable Wallet System with Stripe (needs valid STRIPE_API_KEY)

### P1
- Generate remaining character images (tiers 13-50)
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
- Ad-free is GamePix ONLY
- Stripe payments are MOCKED/disabled
- Animal character images available for tiers 1-12 only (tiers 13-50 use emoji)
