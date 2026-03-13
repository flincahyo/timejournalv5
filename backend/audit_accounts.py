import asyncio
from sqlalchemy import select, func
from database import AsyncSessionLocal, User, MT5Account, Trade

async def audit():
    async with AsyncSessionLocal() as db:
        # 1. Total Users
        res_users = await db.execute(select(func.count(User.id)))
        print(f"Total Users: {res_users.scalar()}")

        # 2. Total Accounts
        res_accounts = await db.execute(select(MT5Account))
        accounts = res_accounts.scalars().all()
        print(f"Total MT5 Accounts: {len(accounts)}")

        for acc in accounts:
            # 3. Trades per account
            res_trades = await db.execute(select(func.count(Trade.ticket)).where(Trade.account_id == acc.id))
            count = res_trades.scalar()
            status = "ACTIVE" if acc.is_active else "Inactive"
            print(f"  - Account {acc.login} ({acc.server}) [{status}]: {count} trades stored.")

if __name__ == "__main__":
    print("--- Database Audit (Advanced Schema) ---")
    asyncio.run(audit())
