
import asyncio
from sqlalchemy import text
from database import engine

async def migrate():
    async with engine.begin() as conn:
        print("Dropping old primary key and creating composite PK...")
        try:
            # Drop existing PK (usually named trades_pkey)
            await conn.execute(text("ALTER TABLE trades DROP CONSTRAINT IF EXISTS trades_pkey;"))
            # Add new PK
            await conn.execute(text("ALTER TABLE trades ADD PRIMARY KEY (id, user_id);"))
            print("Migration successful.")
        except Exception as e:
            print(f"Migration failed: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
