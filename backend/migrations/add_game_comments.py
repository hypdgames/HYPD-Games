"""
Migration: create game_comments table
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
        print("Creating game_comments table...")
        try:
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS game_comments (
                    id VARCHAR(36) PRIMARY KEY,
                    game_id VARCHAR(36) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
                    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    content VARCHAR(500) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            """))
            await session.execute(text("CREATE INDEX IF NOT EXISTS ix_game_comments_game_id ON game_comments (game_id);"))
            await session.execute(text("CREATE INDEX IF NOT EXISTS ix_game_comments_created_at ON game_comments (created_at);"))
            await session.commit()
            print("game_comments table created successfully.")
        except Exception as e:
            print(f"Error: {e}")
            await session.rollback()

    await engine.dispose()
    print("Migration complete.")

if __name__ == "__main__":
    asyncio.run(run_migration())
