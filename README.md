# HYPD Games

Current production stack:
- `frontend/`: Next.js app deployed on Vercel and serving `https://hypd.games`
- `backend/`: FastAPI app deployed on Railway
- Supabase: Postgres, auth, and lightweight storage

## Local Development

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend
/opt/homebrew/bin/python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --reload --port 8001
```

Copy the example env files before running locally:
- `frontend/.env.example`
- `backend/.env.example`

## Source Of Truth

Treat these paths as active:
- `frontend/`
- `backend/`

Treat these as legacy or historical:
- `frontend-old/`
- `docker-compose.yml`
- root `.env.example` from the old Mongo/docker flow
