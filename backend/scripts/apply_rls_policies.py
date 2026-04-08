"""
Apply Row-Level Security (RLS) policies to all Supabase tables.

Policy Design:
  - Public READ: games, app_settings, coin_packages (safe catalog data)
  - Authenticated READ own data: users (own row), wallet_transactions (own rows),
                                  play_sessions (own rows), game_comments (all public)
  - NO write access via PostgREST on any table — all writes go through FastAPI backend
                                      which validates, rate-limits, and enforces business logic.

After running this script:
  * Anonymous users can browse the game catalog and read public settings
  * Authenticated users (valid JWT) can read their own profile/wallet/sessions
  * No user can INSERT/UPDATE/DELETE any data via PostgREST
  * Our FastAPI backend (superuser connection) bypasses ALL RLS — unchanged

Prerequisites for per-user policies to activate:
  The Supabase project's JWT secret must match our JWT_SECRET:
    "hypd-games-prod-secret-key-xK9mP2nQ7vL4wR8t"
  Set it in: Supabase Dashboard → Project Settings → API → JWT Settings → JWT Secret
"""
import sys
import os
from pathlib import Path
from urllib.parse import unquote

sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / '.env')

import psycopg2

DATABASE_URL = os.environ.get('DATABASE_URL', '')
raw = DATABASE_URL.replace('postgresql://', '', 1)
at_idx = raw.rfind('@')
userinfo = raw[:at_idx]
hostinfo = raw[at_idx + 1:].split('?')[0]
user = unquote(userinfo[:userinfo.index(':')])
password = unquote(userinfo[userinfo.index(':') + 1:])
host_port, dbname = hostinfo.split('/', 1)
host, port = host_port.rsplit(':', 1)

conn = psycopg2.connect(
    host=host, port=int(port), dbname=dbname,
    user=user, password=password,
    sslmode='require', connect_timeout=15,
)
conn.autocommit = True
cur = conn.cursor()

# ─────────────────────────────────────────────────────────────────────────────
# Drop existing policies (idempotent — safe to re-run)
# ─────────────────────────────────────────────────────────────────────────────
POLICIES_TO_DROP = [
    # games
    ("games",               "games_public_select"),
    # app_settings
    ("app_settings",        "app_settings_public_select"),
    # coin_packages
    ("coin_packages",       "coin_packages_public_select"),
    # game_comments
    ("game_comments",       "game_comments_public_select"),
    ("game_comments",       "game_comments_auth_insert"),
    ("game_comments",       "game_comments_auth_delete_own"),
    # comment_likes
    ("comment_likes",       "comment_likes_public_select"),
    # users
    ("users",               "users_auth_select_own"),
    # wallet_transactions
    ("wallet_transactions", "wallet_transactions_auth_select_own"),
    # play_sessions
    ("play_sessions",       "play_sessions_auth_select_own"),
]

print("--- Dropping existing policies (if any) ---")
for table, policy in POLICIES_TO_DROP:
    cur.execute(f'DROP POLICY IF EXISTS "{policy}" ON public."{table}";')
    print(f"  DROP  {table}.{policy}")

# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC READ POLICIES (anon + authenticated)
# No auth required — safe read-only access to public catalog data
# ─────────────────────────────────────────────────────────────────────────────
print("\n--- Adding public read policies ---")

# Games: anyone can read visible games
cur.execute("""
    CREATE POLICY "games_public_select" ON public.games
    FOR SELECT TO anon, authenticated
    USING (is_visible = true);
""")
print("  OK  games → anon/authenticated can SELECT visible games")

# App settings: public config (site name, logo, maintenance mode)
cur.execute("""
    CREATE POLICY "app_settings_public_select" ON public.app_settings
    FOR SELECT TO anon, authenticated
    USING (true);
""")
print("  OK  app_settings → anon/authenticated can SELECT all settings")

# Coin packages: pricing page
cur.execute("""
    CREATE POLICY "coin_packages_public_select" ON public.coin_packages
    FOR SELECT TO anon, authenticated
    USING (is_active = true);
""")
print("  OK  coin_packages → anon/authenticated can SELECT active packages")

# Game comments: public read (comments appear on game cards)
cur.execute("""
    CREATE POLICY "game_comments_public_select" ON public.game_comments
    FOR SELECT TO anon, authenticated
    USING (true);
""")
print("  OK  game_comments → anon/authenticated can SELECT all comments")

# Comment likes: public read (to show like counts)
cur.execute("""
    CREATE POLICY "comment_likes_public_select" ON public.comment_likes
    FOR SELECT TO anon, authenticated
    USING (true);
""")
print("  OK  comment_likes → anon/authenticated can SELECT all likes")

# ─────────────────────────────────────────────────────────────────────────────
# AUTHENTICATED OWN-DATA READ POLICIES
# Requires: Supabase JWT secret = "hypd-games-prod-secret-key-xK9mP2nQ7vL4wR8t"
# auth.uid() returns the `sub` claim from the JWT, which = user's UUID
# ─────────────────────────────────────────────────────────────────────────────
print("\n--- Adding authenticated own-data read policies ---")

# Users: can only read their own profile row
cur.execute("""
    CREATE POLICY "users_auth_select_own" ON public.users
    FOR SELECT TO authenticated
    USING (auth.uid()::text = id);
""")
print("  OK  users → authenticated can SELECT only their own row")

# Wallet transactions: can only read own financial records
cur.execute("""
    CREATE POLICY "wallet_transactions_auth_select_own" ON public.wallet_transactions
    FOR SELECT TO authenticated
    USING (auth.uid()::text = user_id);
""")
print("  OK  wallet_transactions → authenticated can SELECT only own transactions")

# Play sessions: can only read own activity history
cur.execute("""
    CREATE POLICY "play_sessions_auth_select_own" ON public.play_sessions
    FOR SELECT TO authenticated
    USING (auth.uid()::text = user_id);
""")
print("  OK  play_sessions → authenticated can SELECT only own sessions")

# ─────────────────────────────────────────────────────────────────────────────
# VERIFY: List all policies
# ─────────────────────────────────────────────────────────────────────────────
print("\n--- Final policy summary ---")
cur.execute("""
    SELECT tablename, policyname, cmd, roles
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
""")
rows = cur.fetchall()
print(f"{'Table':<30} {'Policy':<45} {'CMD':<8} {'Roles'}")
print("-" * 110)
for tname, pname, cmd, roles in rows:
    print(f"{tname:<30} {pname:<45} {cmd:<8} {roles}")

cur.close()
conn.close()

print(f"\nTotal policies applied: {len(rows)}")
print("""
─────────────────────────────────────────────────────────────────────
NEXT STEP (required to activate per-user policies):

Update the Supabase JWT secret to match our app's JWT_SECRET:

  1. Go to: https://supabase.com/dashboard/project/kmgymgivnactoigjfbbh
  2. Navigate: Project Settings → API → JWT Settings
  3. Set JWT Secret to: hypd-games-prod-secret-key-xK9mP2nQ7vL4wR8t
  4. Click Save

After this, any valid HYPD JWT (role=authenticated) will work with
the PostgREST policies above, and users can only read their own data.
─────────────────────────────────────────────────────────────────────
""")
