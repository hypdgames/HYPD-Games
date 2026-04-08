"""
Enable Row-Level Security (RLS) on all Supabase tables.

Our FastAPI backend connects via direct PostgreSQL (bypasses RLS entirely).
RLS only affects Supabase's PostgREST auto-generated API — this script
locks down all direct table access through that API.
"""
import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / '.env')

import psycopg2
from urllib.parse import urlparse, unquote

DATABASE_URL = os.environ.get('DATABASE_URL', '')

# Parse URL manually to handle special chars in password (e.g., ??)
# Format: postgresql://user:password@host:port/database
# Strategy: find the LAST '@' to correctly split userinfo from hostinfo
raw = DATABASE_URL.replace('postgresql://', '', 1)

# rfind('@') finds the LAST '@', which is always the userinfo/host separator
# even if the password contains '@' or '?'
at_idx = raw.rfind('@')
userinfo = raw[:at_idx]
hostinfo_qs = raw[at_idx + 1:]  # may include ?query_string

# Strip any query string from hostinfo (it comes AFTER host:port/dbname)
hostinfo = hostinfo_qs.split('?')[0]

colon_idx = userinfo.index(':')
user = unquote(userinfo[:colon_idx])
# Password is everything after the first ':' in userinfo
password = unquote(userinfo[colon_idx + 1:])

# host:port/dbname
slash_idx = hostinfo.index('/')
host_port = hostinfo[:slash_idx]
dbname = hostinfo[slash_idx + 1:]

if ':' in host_port:
    host, port = host_port.rsplit(':', 1)
    port = int(port)
else:
    host = host_port
    port = 5432

print(f"Connecting to: {host}:{port}/{dbname} as {user}")

# All tables defined in models.py
TABLES = [
    'users',
    'friendships',
    'challenges',
    'challenge_participants',
    'leaderboard_entries',
    'analytics_events',
    'daily_stats',
    'games',
    'play_sessions',
    'app_settings',
    'wallet_transactions',
    'coin_packages',
    'premium_games',
    'user_unlocked_games',
    'idle_game_states',
    'game_comments',
    'comment_likes',
]

conn = psycopg2.connect(
    host=host,
    port=port,
    dbname=dbname,
    user=user,
    password=password,
    connect_timeout=15,
    sslmode='require',
)
conn.autocommit = True
cur = conn.cursor()

print("\n--- Enabling RLS on all tables ---")
enabled = []
skipped = []
for table in TABLES:
    try:
        # Check if table exists
        cur.execute(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=%s)",
            (table,)
        )
        exists = cur.fetchone()[0]
        if not exists:
            print(f"  SKIP  {table} (table does not exist)")
            skipped.append(table)
            continue

        # Enable RLS
        cur.execute(f'ALTER TABLE public."{table}" ENABLE ROW LEVEL SECURITY;')
        # Force RLS even for table owner (belt-and-suspenders)
        cur.execute(f'ALTER TABLE public."{table}" FORCE ROW LEVEL SECURITY;')
        print(f"  OK    {table}")
        enabled.append(table)
    except Exception as e:
        print(f"  ERROR {table}: {e}")

print(f"\n--- Verifying RLS status ---")
cur.execute("""
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
""")
rows = cur.fetchall()
print(f"{'Table':<35} {'RLS':>5}")
print("-" * 42)
rls_off = []
for tname, rls in rows:
    status = "ON " if rls else "OFF"
    flag = "" if rls else " <-- WARNING: RLS STILL OFF"
    print(f"{tname:<35} {status:>5}{flag}")
    if not rls:
        rls_off.append(tname)

cur.close()
conn.close()
print(f"\nDone. Enabled RLS on {len(enabled)} tables. Skipped {len(skipped)}.")
if rls_off:
    print(f"WARNING: {len(rls_off)} tables still have RLS off: {rls_off}")
else:
    print("SUCCESS: All public tables now have RLS enabled.")
