# Hypd Games - Product Requirements Document

## Project Overview
**Name:** Hypd Games  
**Type:** Mobile-first instant gaming website  
**Core Concept:** TikTok-style vertical endless scroll feed for HTML5 browser games  

## Original Problem Statement
Build a mobile-first instant gaming website featuring a vertical, "TikTok-style" endless scroll feed where users swipe through game previews and tap to play instantly. Features include Game Feed, Game Player (fullscreen with draggable back button), Navigation tabs (Feed, Explore, PRO, Profile), and Admin Dashboard for game management.

## User Choices
- **Authentication:** JWT-based custom auth (email/password)
- **Storage:** Mock storage with MongoDB (no external cloud storage)
- **PRO Membership:** Placeholder page for now
- **Sample Games:** Included 4 HTML5 games for demo
- **Design:** Dark gaming aesthetic with lime (#CCFF00) accent color

## User Personas
1. **Casual Mobile Gamers** - Looking for instant browser games during commute/breaks
2. **Game Publishers** - Want to publish and manage HTML5 games
3. **Platform Admins** - Need to curate and manage game catalog

## Core Requirements (Static)
1. Mobile-first responsive design
2. TikTok-style vertical snap scrolling
3. Instant game loading (no downloads)
4. User authentication with progress saving
5. Admin game management dashboard

## What's Been Implemented (January 17, 2026)

### Backend (FastAPI + MongoDB)
- ✅ JWT Authentication (register, login, profile)
- ✅ Game CRUD operations
- ✅ Game file storage with GridFS (mock)
- ✅ User saved games & high scores
- ✅ Admin game management endpoints
- ✅ Settings endpoint for logo customization
- ✅ Sample game seeding endpoint
- ✅ 4 embedded HTML5 games (Neon Blocks, Space Dodge, Color Match, Cyber Runner)
- ✅ **Analytics System** - Play session tracking, overview stats, per-game analytics

### Frontend (React)
- ✅ Game Feed - TikTok-style vertical snap scroll
- ✅ Game Player - Fullscreen iframe with draggable back button + session tracking
- ✅ Explore Page - Category tiles, search, grid view
- ✅ PRO Page - Membership placeholder with pricing plans
- ✅ Profile Page - Login/Register, saved games, high scores
- ✅ Admin Dashboard - Game management, logo upload, seed games
- ✅ **Analytics Dashboard** - Charts for plays, categories, top games, detailed game stats
- ✅ Bottom Navigation - Glass effect, 4 tabs

### Design System
- Dark theme (#050505 background)
- Lime accent (#CCFF00)
- Chivo (headings) + Manrope (body) fonts
- Glassmorphism effects
- Framer Motion animations

## Test Credentials
- **Admin:** admin@hypd.games / admin123

## P0 Features (Completed)
- [x] Game Feed with snap scrolling
- [x] Game Player with fullscreen
- [x] User authentication
- [x] Admin game management
- [x] Bottom navigation

## P1 Features (Next Phase)
- [ ] Video previews for games
- [ ] Social sharing integration
- [ ] User leaderboards
- [ ] Game progress auto-save

## P2 Features (Future)
- [ ] Stripe integration for PRO membership
- [ ] Cloud storage (S3) for game files
- [ ] Push notifications
- [ ] Game recommendations based on play history

## Next Action Items
1. Integrate actual payment processing for PRO tier
2. Add real cloud storage for game file uploads
3. Implement game analytics and play tracking
4. Add social features (friends, challenges)
5. SEO optimization for game discovery
