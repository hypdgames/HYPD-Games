"""
Migration script to add login streak columns to users table
"""

import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get('DATABASE_URL', '')
if DATABASE_URL.startswith('postgresql://'):
    DATABASE_URL = DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://', 1)

async def run_migration():
    engine = create_async_engine(DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        print("Adding login streak columns to users table...")
        
        columns_to_add = [
            ("login_streak", "INTEGER DEFAULT 0"),
            ("best_login_streak", "INTEGER DEFAULT 0"),
            ("last_login_date", "DATE"),
            ("total_login_days", "INTEGER DEFAULT 0"),
            ("streak_points", "INTEGER DEFAULT 0"),
        ]
        
        for col_name, col_type in columns_to_add:
            try:
                await session.execute(text(f"""
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS {col_name} {col_type};
                """))
                await session.commit()
                print(f"✓ Added column: {col_name}")
            except Exception as e:
                print(f"Note for {col_name}: {e}")
                await session.rollback()
        
        # Initialize existing users with 0 streaks
        try:
            await session.execute(text("""
                UPDATE users 
                SET login_streak = 0, best_login_streak = 0, total_login_days = 0, streak_points = 0
                WHERE login_streak IS NULL;
            """))
            await session.commit()
            print("✓ Initialized existing users with default streak values")
        except Exception as e:
            print(f"Note: {e}")
            await session.rollback()
    
    await engine.dispose()
    print("\n✓ Migration completed!")

if __name__ == "__main__":
    asyncio.run(run_migration())
