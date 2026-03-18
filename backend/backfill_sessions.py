import asyncio
import datetime
import pytz
from database import AsyncSessionLocal, Trade, MT5Account
from sqlalchemy import select, update

# Match logic in main.py
def detect_session(dt_val):
    if not dt_val: return "Unknown"
    try:
        dt_utc = None
        if isinstance(dt_val, str):
            dt_str = dt_val.strip().replace(" ", "T").replace("/", "-").replace(".", "-")
            if dt_str.endswith("Z"):
                dt_utc = datetime.datetime.fromisoformat(dt_str.replace("Z", "+00:00")).astimezone(pytz.UTC)
            elif "+" in dt_str or ("-" in dt_str[10:] and len(dt_str) > 10):
                dt_utc = datetime.datetime.fromisoformat(dt_str).astimezone(pytz.UTC)
            elif len(dt_str) >= 19:
                dt_naive = datetime.datetime.fromisoformat(dt_str[:19])
                dt_utc = pytz.timezone("Asia/Jakarta").localize(dt_naive).astimezone(pytz.UTC)
            else:
                dt_utc = datetime.datetime.fromisoformat(dt_str).astimezone(pytz.UTC)
        elif isinstance(dt_val, (int, float)):
            dt_utc = datetime.datetime.fromtimestamp(dt_val, tz=pytz.UTC)
        elif isinstance(dt_val, datetime.datetime):
            if dt_val.tzinfo is None:
                dt_utc = pytz.timezone("Asia/Jakarta").localize(dt_val).astimezone(pytz.UTC)
            else:
                dt_utc = dt_val.astimezone(pytz.UTC)
        else:
            return "Unknown"
        
        london_tz = pytz.timezone("Europe/London")
        ny_tz = pytz.timezone("America/New_York")
        tokyo_tz = pytz.timezone("Asia/Tokyo")
        
        dt_london = dt_utc.astimezone(london_tz)
        dt_ny = dt_utc.astimezone(ny_tz)
        dt_tokyo = dt_utc.astimezone(tokyo_tz)
        
        l_h = dt_london.hour
        ny_h = dt_ny.hour
        tk_h = dt_tokyo.hour
        
        # Session Hours based on user screenshot (WIB)
        wib_h = (dt_utc.hour + 7) % 24
        
        l_open = 14 <= wib_h < 24
        ny_open = (19 <= wib_h < 24) or (0 <= wib_h < 5)
        tk_open = 2 <= wib_h < 9
        s_open = 4 <= wib_h < 13
        
        if l_open and ny_open: return "Overlap LN+NY"
        if l_open: return "London"
        if ny_open: return "New York"
        if tk_open: return "Tokyo"
        if s_open: return "Sydney"
        
        return "Unknown"
    except: return "Unknown"

async def backfill():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Trade))
        trades = res.scalars().all()
        print(f"Checking {len(trades)} trades for missing sessions...")
        
        updated = 0
        for t in trades:
            data = dict(t.data)
            time_val = data.get("openTime") or data.get("time")
            
            # Update session if missing or "Unknown" or the old "Overlap (LDN+NY)" string
            curr_sess = data.get("session")
            if not curr_sess or curr_sess == "Unknown" or "Overlap" in curr_sess:
                new_session = detect_session(time_val)
                if new_session and new_session != curr_sess:
                    data["session"] = new_session
                    t.data = data
                    # Mark as modified for SQLAlchemy
                    from sqlalchemy.orm.attributes import flag_modified
                    flag_modified(t, "data")
                    updated += 1
        
        if updated > 0:
            await db.commit()
            print(f"✅ Success: Updated {updated} trades with session metadata.")
        else:
            print("No trades required updating.")

if __name__ == "__main__":
    asyncio.run(backfill())
