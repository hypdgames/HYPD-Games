"""
Migration script to add wallet/coins system tables and columns.
Run this script to update the database schema.
"""

import asyncio
import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from database import engine

async def run_migration():
    """Add wallet system tables and columns"""
    
    async with engine.begin() as conn:
        print("Starting wallet system migration...")
        
        # 1. Add wallet columns to users table
        wallet_columns = [
            ("coin_balance", "INTEGER DEFAULT 0"),
            ("total_coins_purchased", "INTEGER DEFAULT 0"),
            ("total_coins_spent", "INTEGER DEFAULT 0"),
            ("total_coins_earned", "INTEGER DEFAULT 0"),
            ("is_ad_free", "BOOLEAN DEFAULT FALSE"),
            ("ad_free_until", "TIMESTAMP WITH TIME ZONE"),
        ]
        
        for col_name, col_type in wallet_columns:
            try:
                await conn.execute(text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
                print(f"  ✓ Added column users.{col_name}")
            except Exception as e:
                if "already exists" in str(e).lower():
                    print(f"  - Column users.{col_name} already exists")
                else:
                    print(f"  ✗ Error adding users.{col_name}: {e}")
        
        # 2. Create transaction_type enum
        try:
            await conn.execute(text("""
                DO $$ BEGIN
                    CREATE TYPE transactiontype AS ENUM ('purchase', 'spend', 'bonus', 'refund', 'admin');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """))
            print("  ✓ Created transactiontype enum")
        except Exception as e:
            print(f"  - transactiontype enum: {e}")
        
        # 3. Create transaction_status enum
        try:
            await conn.execute(text("""
                DO $$ BEGIN
                    CREATE TYPE transactionstatus AS ENUM ('pending', 'completed', 'failed', 'refunded');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """))
            print("  ✓ Created transactionstatus enum")
        except Exception as e:
            print(f"  - transactionstatus enum: {e}")
        
        # 4. Create wallet_transactions table
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS wallet_transactions (
                    id VARCHAR(36) PRIMARY KEY,
                    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    transaction_type transactiontype NOT NULL,
                    status transactionstatus DEFAULT 'pending',
                    coins INTEGER NOT NULL,
                    amount_usd FLOAT,
                    stripe_session_id VARCHAR(255) UNIQUE,
                    stripe_payment_id VARCHAR(255),
                    package_id VARCHAR(50),
                    spend_type VARCHAR(50),
                    spend_reference VARCHAR(255),
                    description VARCHAR(500),
                    metadata JSONB DEFAULT '{}',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    completed_at TIMESTAMP WITH TIME ZONE
                )
            """))
            print("  ✓ Created wallet_transactions table")
            
            # Create indexes
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_id ON wallet_transactions(user_id)"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_wallet_tx_type ON wallet_transactions(transaction_type)"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_wallet_tx_status ON wallet_transactions(status)"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_wallet_tx_stripe_session ON wallet_transactions(stripe_session_id)"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_wallet_tx_created ON wallet_transactions(created_at)"))
            print("  ✓ Created wallet_transactions indexes")
        except Exception as e:
            print(f"  ✗ Error creating wallet_transactions: {e}")
        
        # 5. Create coin_packages table
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS coin_packages (
                    id VARCHAR(36) PRIMARY KEY,
                    package_id VARCHAR(50) UNIQUE NOT NULL,
                    name VARCHAR(100) NOT NULL,
                    coins INTEGER NOT NULL,
                    price_usd FLOAT NOT NULL,
                    bonus_coins INTEGER DEFAULT 0,
                    is_popular BOOLEAN DEFAULT FALSE,
                    is_active BOOLEAN DEFAULT TRUE,
                    sort_order INTEGER DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            print("  ✓ Created coin_packages table")
            
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_coin_pkg_id ON coin_packages(package_id)"))
            print("  ✓ Created coin_packages indexes")
        except Exception as e:
            print(f"  ✗ Error creating coin_packages: {e}")
        
        # 6. Create premium_games table
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS premium_games (
                    id VARCHAR(36) PRIMARY KEY,
                    game_id VARCHAR(36) NOT NULL UNIQUE REFERENCES games(id) ON DELETE CASCADE,
                    coin_price INTEGER NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            print("  ✓ Created premium_games table")
        except Exception as e:
            print(f"  ✗ Error creating premium_games: {e}")
        
        # 7. Create user_unlocked_games table
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS user_unlocked_games (
                    id VARCHAR(36) PRIMARY KEY,
                    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    game_id VARCHAR(36) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
                    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    UNIQUE(user_id, game_id)
                )
            """))
            print("  ✓ Created user_unlocked_games table")
            
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_user_unlocked_user ON user_unlocked_games(user_id)"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_user_unlocked_game ON user_unlocked_games(game_id)"))
            print("  ✓ Created user_unlocked_games indexes")
        except Exception as e:
            print(f"  ✗ Error creating user_unlocked_games: {e}")
        
        # 8. Seed default coin packages
        try:
            await conn.execute(text("""
                INSERT INTO coin_packages (id, package_id, name, coins, price_usd, bonus_coins, is_popular, sort_order)
                VALUES 
                    ('pkg-starter', 'starter', 'Starter Pack', 100, 0.99, 0, FALSE, 1),
                    ('pkg-popular', 'popular', 'Popular Pack', 550, 4.99, 50, TRUE, 2),
                    ('pkg-value', 'value', 'Value Pack', 1200, 9.99, 200, FALSE, 3),
                    ('pkg-mega', 'mega', 'Mega Pack', 2700, 19.99, 700, FALSE, 4),
                    ('pkg-ultimate', 'ultimate', 'Ultimate Pack', 7000, 49.99, 2000, FALSE, 5)
                ON CONFLICT (package_id) DO NOTHING
            """))
            print("  ✓ Seeded default coin packages")
        except Exception as e:
            print(f"  - Coin packages seeding: {e}")
        
        print("\n✅ Wallet system migration completed!")

if __name__ == "__main__":
    asyncio.run(run_migration())
