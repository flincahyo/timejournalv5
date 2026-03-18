import asyncio
import json
from database import AsyncSessionLocal, Trade
from sqlalchemy import select

async def debug_unknown_sessions():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Trade))
        trades = res.scalars().all()
        
        unknown_trades = []
        for t in trades:
            data = t.data
            if data.get("session") == "Unknown":
                unknown_trades.append({
                    "ticket": t.ticket,
                    "openTime": data.get("openTime"),
                    "time": data.get("time"),
                    "open_time": data.get("open_time"),
                    "raw_data": data
                })
        
        print(f"Found {len(unknown_trades)} trades with Unknown session.")
        for ut in unknown_trades[:10]: # Print first 10
            print(json.dumps(ut, indent=2))

if __name__ == "__main__":
    asyncio.run(debug_unknown_sessions())
