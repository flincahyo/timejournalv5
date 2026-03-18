import asyncio
import os
import json
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text
from database import JournalTag, DailyTag, Trade

# Database URL from .env
DATABASE_URL = "postgresql+asyncpg://timejournal:timejournal@192.168.232.96:5432/timejournal"

async def check_db():
    engine = create_async_engine(DATABASE_URL)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with AsyncSessionLocal() as db:
        print("--- Journal Tags (Master) ---")
        res = await db.execute(select(JournalTag))
        for row in res.scalars().all():
            print(f"User: {row.user_id}, Name: {row.name}")
            
        print("\n--- Daily Tags ---")
        res = await db.execute(select(DailyTag))
        for row in res.scalars().all():
            print(f"User: {row.user_id}, Day: {row.day}, Tag: {row.tag}")
            
        print("\n--- Recent Trades with Setup/Emotion ---")
        res = await db.execute(select(Trade).order_by(Trade.synced_at.desc()).limit(5))
        for t in res.scalars().all():
            data = t.data
            print(f"Ticket: {t.ticket}, Setup: {data.get('setup')}, Emotion: {data.get('emotion')}, Day: {data.get('openTime', '').split('T')[0]}")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_db())
