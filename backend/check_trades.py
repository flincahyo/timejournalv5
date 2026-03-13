
import asyncio
from sqlalchemy import select
from database import AsyncSessionLocal, Trade, User
import json

async def check():
    async with AsyncSessionLocal() as db:
        # Get Sample User
        res = await db.execute(select(User))
        user = res.scalars().first()
        if not user:
            print("No users found")
            return
        print(f"Checking trades for user: {user.email} (ID: {user.id})")
        
        # Simulate /api/mt5/trades
        result = await db.execute(select(Trade).where(Trade.user_id == user.id))
        trades = [r.data for r in result.scalars().all()]
        print(f"Found {len(trades)} trades in JSON format via query.")
        if trades:
            sample = trades[0]
            print(f"Sample trade ID: {sample.get('id')}")
            print(f"Sorting trades...")
            sorted_trades = sorted(trades, key=lambda x: x.get("openTime", ""), reverse=True)
            print("Sorted successfully.")

if __name__ == "__main__":
    asyncio.run(check())
