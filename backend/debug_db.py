import asyncio
from database import AsyncSessionLocal, Trade, MT5Account, User
from sqlalchemy import select

async def check_data():
    async with AsyncSessionLocal() as db:
        # Check all trades
        res = await db.execute(select(Trade))
        trades = res.scalars().all()
        print(f"Total trades in DB: {len(trades)}")
        
        null_account = [t for t in trades if t.account_id is None]
        print(f"Trades with NULL account_id: {len(null_account)}")
        
        # Check accounts
        res = await db.execute(select(MT5Account))
        accounts = res.scalars().all()
        print(f"Total accounts in DB: {len(accounts)}")
        for acc in accounts:
            print(f"Account ID: {acc.id}, Login: {acc.login}, User: {acc.user_id}, Active: {acc.is_active}")

if __name__ == "__main__":
    asyncio.run(check_data())
