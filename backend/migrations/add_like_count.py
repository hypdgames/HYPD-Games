"""
Migration: add like_count to games table and backfill from saved_games
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
    engine = create_async_engine(DATABASE_URL, echo=True,
        connect_args={"statement_cache_size": 0, "command_timeout": 30})
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        print("Adding like_count column to games table...")
        try:
            await session.execute(text(
                "ALTER TABLE games ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;"
            ))
            await session.commit()
            print("Column added.")
        except Exception as e:
            print(f"Add column note: {e}")
            await session.rollback()

        print("Backfilling like_count from saved_games...")
        try:
            await session.execute(text("""
                UPDATE games g
                SET like_count = (
                    SELECT COUNT(*)
                    FROM users u
                    WHERE u.saved_games::jsonb ? g.id
                );
            """))
            await session.commit()
            print("Backfill complete.")
        except Exception as e:
            print(f"Backfill note: {e}")
            await session.rollback()

    await engine.dispose()
    print("Migration complete.")

if __name__ == "__main__":
    asyncio.run(run_migration())
