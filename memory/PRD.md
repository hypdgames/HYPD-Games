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
- **Pet Idle Game (Gun Idle style)**: Auto-attack idle game with 50 animal tiers, battle arena, target HP system, animal roster with upgrade buttons, player level progression, tap-to-attack, prestige, offline earnings

## Tech Stack
- **Frontend**: Next.js 14, React, Tailwind CSS, Shadcn/UI, Zustand, Framer Motion
- **Backend**: FastAPI, Python, SQLAlchemy (async)
- **Database**: PostgreSQL via Supabase
- **3rd Party**: GamePix, GameMonetize, Google AdSense, Stripe (disabled)

## Architecture
```
/app/
├── backend/
│   ├── server.py (includes idle game save/load endpoints)
│   ├── models.py (includes IdleGameState model)
│   └── database.py
├── frontend/
│   ├── src/app/
│   │   ├── admin/
│   │   ├── explore/
│   │   ├── idle-game/
│   │   │   ├── page.tsx (main game: arena + roster + prestige)
│   │   │   ├── components/
│   │   │   │   ├── BattleArena.tsx (animal, projectiles, target, HP bar, tap damage)
│   │   │   │   └── AnimalRoster.tsx (scrollable upgrade list)
│   │   │   ├── data/
│   │   │   │   └── animals.ts (50 animals: unlock levels, DPS, costs, images)
│   │   │   └── hooks/
│   │   │       └── useGameState.ts (tick loop, tap, upgrade, prestige, save/load)
│   │   ├── play/[gameId]/
│   │   ├── profile/ (refactored: 10 child components)
│   │   └── wallet/ (deprecated)
│   ├── src/components/ (navbar, bottom-nav w/ center Pet Idle, ui/)
│   └── src/store/ (auth-store, theme-store)
```

## Latest Implemented (Feb 9, 2026)
- [x] Pet Idle Game rebuilt as Gun Idle-style auto-attack game (NOT merge grid)
- [x] Battle arena: animal shoots projectiles at target, target has HP, destroyed targets give coins+XP
- [x] Animal roster: scrollable list with upgrade buttons, locked animals show unlock requirements
- [x] Player level system: XP from destroying targets, new animals unlock at milestones
- [x] Tap-to-attack: bonus damage with floating damage text
- [x] Prestige system: reset for permanent DPS multiplier
- [x] Offline earnings (50% rate)
- [x] 12 custom character images, 38 emoji fallbacks
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
- Animal character images available for tiers 1-12 only (13-50 use emoji)
