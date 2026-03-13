
import asyncio
from sqlalchemy import select
from database import AsyncSessionLocal, Trade

async def check():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Trade))
        trades = res.scalars().all()
        print(f"Total trades in DB: {len(trades)}")
        if trades:
            print(f"Sample trade data: {trades[0].data}")
            print(f"Sample user_id: {trades[0].user_id}")

if __name__ == "__main__":
    asyncio.run(check())
