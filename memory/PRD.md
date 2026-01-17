# Hypd Games - Product Requirements Document

## Project Overview
**Name:** Hypd Games  
**Type:** Mobile-first instant gaming website  
**Core Concept:** TikTok-style vertical endless scroll feed for HTML5 browser games  

## Original Problem Statement
Build a mobile-first instant gaming website featuring a vertical, "TikTok-style" endless scroll feed where users swipe through game previews and tap to play instantly. Features include Game Feed, Game Player (fullscreen with draggable back button), Navigation tabs (Feed, Explore, PRO, Profile), and Admin Dashboard for game management.

## User Choices
- **Authentication:** JWT-based custom auth (email/password)
- **Storage:** Mock storage with MongoDB GridFS (not AWS S3)
- **PRO Membership:** Placeholder page for now
- **Sample Games:** 4+ HTML5 games included for demo
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

---

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
- ✅ **Retention Analytics** - Day 1/7/30 retention, cohort analysis, DAU trend
- ✅ **Export Analytics** - CSV and JSON export endpoints
- ✅ **WebGL Support** - Extended MIME types for WebGL/Unity games

### Frontend (React)
- ✅ Game Feed - TikTok-style vertical snap scroll
- ✅ Game Player - Fullscreen iframe with draggable back button + session tracking
- ✅ Explore Page - Category tiles, search, grid view
- ✅ PRO Page - Membership placeholder with pricing plans
- ✅ Profile Page - Login/Register, saved games, high scores
- ✅ Admin Dashboard - Game management, logo upload, seed games
- ✅ **Analytics Dashboard** - Tabs for Overview, Retention, Games + Export buttons
- ✅ **Theme System** - Auto/Light/Dark modes with localStorage persistence
- ✅ **Upload Progress** - Visual progress indicator for game uploads
- ✅ Bottom Navigation - Glass effect, 4 tabs

### Design System
- Dark theme (#050505 background)
- Light theme support
- Lime accent (#CCFF00)
- Chivo (headings) + Manrope (body) fonts
- Glassmorphism effects
- Framer Motion animations

---

## Test Credentials
- **Admin:** admin@hypd.games / admin123

---

## P0 Features (Completed ✅)
- [x] Game Feed with snap scrolling
- [x] Game Player with fullscreen
- [x] User authentication
- [x] Admin game management
- [x] Bottom navigation

## P1 Features (Completed ✅ - January 17, 2026)
- [x] Upload progress indicators for game files
- [x] WebGL game support (extended MIME types)

## P2 Features (Completed ✅ - January 17, 2026)
- [x] Theme persistence in localStorage
- [x] Auto theme option (follows system preference)
- [x] User retention metrics (Day 1/7/30)
- [x] Cohort analysis
- [x] CSV/JSON export for analytics

## Future Features (Backlog)
- [ ] Video previews for games
- [ ] Social sharing integration
- [ ] User leaderboards
- [ ] Game progress auto-save
- [ ] Stripe integration for PRO membership
- [ ] Cloud storage (S3) for game files
- [ ] Push notifications
- [ ] Game recommendations based on play history
- [ ] SEO optimization for game discovery
- [ ] Next.js migration for SSR (original requirement)

---

## Key API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Games
- `GET /api/games` - List all games
- `GET /api/games/{id}/play` - Get game content
- `GET /api/games/{id}/assets/{path}` - Serve game assets

### Analytics (Admin)
- `GET /api/admin/analytics/overview` - Overview stats
- `GET /api/admin/analytics/retention` - Retention & cohort data
- `GET /api/admin/analytics/export/csv` - Export as CSV
- `GET /api/admin/analytics/export/json` - Export as JSON
- `GET /api/admin/analytics/game/{id}` - Per-game analytics

### Admin
- `POST /api/admin/games/create-with-files` - Create game with uploads
- `PUT /api/admin/games/{id}/update-with-files` - Update game
- `DELETE /api/admin/games/{id}` - Delete game
- `POST /api/admin/seed` - Seed sample games

---

## Architecture
```
/app/
├── backend/
│   ├── server.py          # FastAPI application
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── pages/
│   │   │   ├── GameFeed.jsx
│   │   │   ├── GamePlayer.jsx
│   │   │   ├── Explore.jsx
│   │   │   ├── Pro.jsx
│   │   │   ├── Profile.jsx
│   │   │   ├── AdminDashboard.jsx
│   │   │   └── AnalyticsDashboard.jsx
│   │   ├── contexts/
│   │   │   └── ThemeContext.jsx
│   │   └── components/
│   │       ├── BottomNav.jsx
│   │       └── ThemeToggle.jsx
│   └── .env
├── memory/
│   └── PRD.md
└── test_reports/
    └── iteration_*.json
```

---

## Database Schema (MongoDB)

### users
```json
{
  "id": "uuid",
  "username": "string",
  "email": "string",
  "password": "hashed",
  "is_admin": "boolean",
  "created_at": "datetime",
  "saved_games": ["game_ids"],
  "high_scores": {"game_id": score}
}
```

### games
```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "category": "string",
  "thumbnail_url": "base64 or url",
  "game_file_id": "GridFS id",
  "has_game_file": "boolean",
  "is_visible": "boolean",
  "play_count": "number",
  "created_at": "datetime"
}
```

### play_sessions
```json
{
  "id": "uuid",
  "game_id": "string",
  "user_id": "string (optional)",
  "duration_seconds": "number",
  "score": "number (optional)",
  "played_at": "datetime",
  "date": "YYYY-MM-DD"
}
```
