
import asyncio
from sqlalchemy import select
from database import AsyncSessionLocal, Trade, User

async def check():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User))
        users = res.scalars().all()
        for u in users:
            res_t = await db.execute(select(Trade).where(Trade.user_id == u.id))
            trades = res_t.scalars().all()
            if trades or u.email in ("ceklogin@gmail.com", "demo@gmail.com"):
                print(f"User: {u.email} (ID: {u.id}) -> {len(trades)} trades")

if __name__ == "__main__":
    asyncio.run(check())
