# Hypd Games - Deployment Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL (Frontend)                        │
│                 Next.js 14 + TypeScript                     │
│              https://hypdgames.vercel.app                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   RAILWAY (Backend)                         │
│                      FastAPI                                │
│           https://hypdgames-api.railway.app                 │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐       ┌─────────────────────────┐
│    SUPABASE Database    │       │   SUPABASE Storage      │
│      PostgreSQL         │       │   (Game Files)          │
└─────────────────────────┘       └─────────────────────────┘
```

---

## Step 1: Deploy Backend to Railway

### 1.1 Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub

### 1.2 Create New Project
1. Click "New Project" → "Deploy from GitHub repo"
2. Select your repository
3. Choose the `backend` folder as the root directory

### 1.3 Configure Environment Variables
In Railway Dashboard → Variables, add:

```
DATABASE_URL=postgresql://postgres.kmgymgivnactoigjfbbh:YOUR_PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://kmgymgivnactoigjfbbh.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
JWT_SECRET=generate-a-strong-random-secret
CORS_ORIGINS=https://your-frontend.vercel.app
```

### 1.4 Deploy
Railway will automatically deploy. Note your Railway URL (e.g., `https://hypdgames-api.up.railway.app`)

---

## Step 2: Deploy Frontend to Vercel

### 2.1 Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub

### 2.2 Import Project
1. Click "Add New" → "Project"
2. Import your GitHub repository
3. Set Root Directory to `frontend`
4. Framework Preset: Next.js (auto-detected)

### 2.3 Configure Environment Variables
In Vercel Dashboard → Settings → Environment Variables, add:

```
NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
```

### 2.4 Deploy
Click "Deploy". Vercel will build and deploy automatically.

---

## Step 3: Update CORS (Important!)

After deploying frontend, go back to Railway and update:

```
CORS_ORIGINS=https://your-frontend.vercel.app
```

---

## Step 4: Custom Domain (Optional)

### Vercel (Frontend)
1. Go to Project Settings → Domains
2. Add your domain (e.g., `hypdgames.com`)
3. Update DNS records as instructed

### Railway (Backend)
1. Go to Service Settings → Networking → Custom Domain
2. Add subdomain (e.g., `api.hypdgames.com`)
3. Update DNS records as instructed

After adding custom domains, update:
- Railway: `CORS_ORIGINS=https://hypdgames.com`
- Vercel: `NEXT_PUBLIC_API_URL=https://api.hypdgames.com`

---

## Environment Variables Summary

### Backend (Railway)
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Supabase PostgreSQL connection string | `postgresql://...` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJ...` |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | `eyJ...` |
| `JWT_SECRET` | Secret for JWT tokens | Random 32+ char string |
| `CORS_ORIGINS` | Allowed frontend origins | `https://hypdgames.com` |

### Frontend (Vercel)
| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://api.hypdgames.com` |

---

## Estimated Costs

| Service | Free Tier | Paid |
|---------|-----------|------|
| Vercel | 100GB bandwidth/mo | $20/mo Pro |
| Railway | $5 free credits/mo | Pay as you go |
| Supabase | 500MB DB, 1GB storage | $25/mo Pro |

**Total: $0-5/month for hobby usage**

---

## Troubleshooting

### CORS Errors
- Ensure `CORS_ORIGINS` in Railway matches your Vercel URL exactly
- Include `https://` prefix
- No trailing slash

### Database Connection Issues
- Verify `DATABASE_URL` format is correct
- Check Supabase dashboard for connection pooler URL

### Build Failures
- Check build logs in Vercel/Railway dashboards
- Ensure all environment variables are set

---

## Post-Deployment Checklist

- [ ] Backend health check: `https://your-api.railway.app/api/health`
- [ ] Frontend loads game feed
- [ ] User can login (admin@hypd.games / admin123)
- [ ] Admin dashboard accessible
- [ ] Games can be uploaded
- [ ] Games can be played

---

## Support

- Vercel Docs: https://vercel.com/docs
- Railway Docs: https://docs.railway.app
- Supabase Docs: https://supabase.com/docs
