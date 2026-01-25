"""
Migration script to add icon_url column to games table
and update existing GamePix games with icon URLs
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
        # Step 1: Add icon_url column if it doesn't exist
        print("Step 1: Adding icon_url column...")
        try:
            await session.execute(text("""
                ALTER TABLE games ADD COLUMN IF NOT EXISTS icon_url TEXT;
            """))
            await session.commit()
            print("✓ icon_url column added successfully")
        except Exception as e:
            print(f"Note: {e}")
            await session.rollback()
        
        # Step 2: Update existing GamePix games to have icon URLs
        # GamePix icon URL pattern: https://img.gamepix.com/games/{namespace}/icon/{namespace}.png?w=105
        # Banner URL pattern: https://img.gamepix.com/games/{namespace}/cover/{namespace}.png?w=320
        print("\nStep 2: Updating existing GamePix games with icon URLs...")
        try:
            # Get all GamePix games
            result = await session.execute(text("""
                SELECT id, gd_game_id, thumbnail_url FROM games 
                WHERE source = 'gamepix' AND gd_game_id IS NOT NULL
            """))
            games = result.fetchall()
            
            updated_count = 0
            for game in games:
                game_id, gd_game_id, thumbnail_url = game
                # Extract namespace from gd_game_id (format: gpx-{namespace})
                if gd_game_id and gd_game_id.startswith('gpx-'):
                    namespace = gd_game_id[4:]  # Remove 'gpx-' prefix
                    # Generate icon URL from namespace
                    icon_url = f"https://img.gamepix.com/games/{namespace}/icon/{namespace}.png?w=105"
                    
                    await session.execute(text("""
                        UPDATE games SET icon_url = :icon_url WHERE id = :game_id
                    """), {"icon_url": icon_url, "game_id": game_id})
                    updated_count += 1
            
            await session.commit()
            print(f"✓ Updated {updated_count} GamePix games with icon URLs")
            
        except Exception as e:
            print(f"Error updating games: {e}")
            await session.rollback()
    
    await engine.dispose()
    print("\n✓ Migration completed!")

if __name__ == "__main__":
    asyncio.run(run_migration())
