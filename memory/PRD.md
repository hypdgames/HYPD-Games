# Hypd Games - Product Requirements Document

## Original Problem Statement
Build "Hypd Games," a mobile-first instant gaming website with a vertical, "TikTok-style" endless scroll feed. React (Next.js) frontend, Python (FastAPI) backend, PostgreSQL (Supabase) database.

## Core Features Implemented
- **Game Feed**: TikTok-style vertical scroll with game cards
- **Multi-Network Game Integration**: GamePix and GameMonetize providers
- **Admin Dashboard**: Game management, network settings, bulk operations
- **Daily Login Streaks**: Track and reward consecutive daily logins
- **Consolidated Profile Page**: Refactored into child components (Streak, Games, Wallet, Friends tabs)
- **Wallet/Coin System**: Coin balance, packages (Stripe MOCKED/disabled)
- **Friends System**: Search, add, accept/decline, remove
- **Pet Idle Game (Gun Idle style)**: Each animal has its own shooting lane, scrollable vertically. Auto-attack targets, upgrade animals, unlock new ones at player level milestones, prestige system, offline earnings.

## Hidden/Disabled Features
- **Pro/Ad-Free features**: All Pro-related UI has been hidden (PRO tab, ad-free purchases, ad-free badge in game player, Pro page redirects to home). Can be re-enabled in the future.
- **Stripe payments**: Mocked/disabled, awaiting API key.

## Pet Idle Game Architecture
Each animal has its own **shooting lane card**:
- Animal character on left with recoil animation
- Green projectile dots flying to target on right
- Target crosshair on right side
- Level Up button at bottom of each card
- Global target HP bar at top of page
- Player level + XP bar for unlocking new animals
- Tap target for bonus damage

## Architecture
```
/app/
├── backend/
│   ├── server.py (includes idle game save/load endpoints)
│   ├── models.py (IdleGameState model)
│   └── database.py
├── frontend/src/app/
│   ├── idle-game/
│   │   ├── page.tsx (main: top bar + target HP + XP + lane list)
│   │   ├── components/
│   │   │   └── AnimalLaneList.tsx (each animal = own shooting scene card)
│   │   ├── data/
│   │   │   └── animals.ts (50 animals, unlock levels, DPS, costs, images)
│   │   └── hooks/
│   │       └── useGameState.ts (tick loop, tap, upgrade, prestige, save/load)
│   ├── profile/ (10 refactored child components)
│   ├── admin/ (7 tab components)
│   └── ...
```

## Prioritized Backlog
### P0
- Enable Wallet System with Stripe

### P1
- Generate remaining character images (tiers 13-50)
- Featured Games section on home feed
- Video Previews for games

### P2
- Social features, notifications, custom game, fonts, SEO
- Re-enable Pro/Ad-Free features when ready

## Key Credentials
- Admin: admin@hypd.games / admin123

## Known Limitations
- Stripe payments MOCKED/disabled
- Animal images for tiers 1-12 only (13-50 use emoji)
- Pro/Ad-Free features hidden (can be re-enabled later)
