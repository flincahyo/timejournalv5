
import asyncio
from sqlalchemy import select
from database import AsyncSessionLocal, MT5Account, User

async def check():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(MT5Account).where(MT5Account.is_active == True))
        conns = res.scalars().all()
        print(f"Total active connections: {len(conns)}")
        for c in conns:
            res_u = await db.execute(select(User).where(User.id == c.user_id))
            u = res_u.scalar_one_or_none()
            email = u.email if u else "Unknown"
            print(f"- User: {email} (ID: {c.user_id}), Login: {c.login}")

if __name__ == "__main__":
    asyncio.run(check())
