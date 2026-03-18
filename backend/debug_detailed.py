import asyncio
import datetime
import pytz
from database import AsyncSessionLocal, Trade
from sqlalchemy import select

def detect_session_debug(dt_val):
    if not dt_val: return "Unknown", "Empty value"
    try:
        dt_utc = None
        if isinstance(dt_val, str):
            dt_str = dt_val.strip().replace(" ", "T").replace("/", "-").replace(".", "-")
            if dt_str.endswith("Z"):
                dt_utc = datetime.datetime.fromisoformat(dt_str.replace("Z", "+00:00")).astimezone(pytz.UTC)
            elif "+" in dt_str or ("-" in dt_str[10:] and len(dt_str) > 10):
                dt_utc = datetime.datetime.fromisoformat(dt_str).astimezone(pytz.UTC)
            elif len(dt_str) >= 19:
                try:
                    dt_naive = datetime.datetime.fromisoformat(dt_str[:19])
                    dt_utc = pytz.timezone("Asia/Jakarta").localize(dt_naive).astimezone(pytz.UTC)
                except Exception as e:
                    return "Unknown", f"ISO naive error: {e}"
            else:
                try:
                    dt_utc = datetime.datetime.fromisoformat(dt_str).astimezone(pytz.UTC)
                except Exception as e:
                    return "Unknown", f"ISO other error: {e}"
        elif isinstance(dt_val, (int, float)):
            dt_utc = datetime.datetime.fromtimestamp(dt_val, tz=pytz.UTC)
        elif isinstance(dt_val, datetime.datetime):
            if dt_val.tzinfo is None:
                dt_utc = pytz.timezone("Asia/Jakarta").localize(dt_val).astimezone(pytz.UTC)
            else:
                dt_utc = dt_val.astimezone(pytz.UTC)
        else:
            return "Unknown", f"Unsupported type: {type(dt_val)}"
        
        if not dt_utc:
            return "Unknown", "DT_UTC is None"

        london_tz = pytz.timezone("Europe/London")
        ny_tz = pytz.timezone("America/New_York")
        tokyo_tz = pytz.timezone("Asia/Tokyo")
        
        dt_london = dt_utc.astimezone(london_tz)
        dt_ny = dt_utc.astimezone(ny_tz)
        dt_tokyo = dt_utc.astimezone(tokyo_tz)
        
        l_h = dt_london.hour
        ny_h = dt_ny.hour
        tk_h = dt_tokyo.hour
        
        l_open = 8 <= l_h < 17
        ny_open = 8 <= ny_h < 17
        tk_open = 9 <= tk_h < 18
        
        if l_open and ny_open: return "London + NY Overlap", "Success"
        if l_open: return "London", "Success"
        if ny_open: return "New York", "Success"
        if tk_open: return "Tokyo", "Success"
        return "Sydney", "Success (Defaulted to Sydney)"
    except Exception as e:
        return "Unknown", f"Catch-all error: {e}"

async def debug():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Trade))
        trades = res.scalars().all()
        for t in trades:
            if t.data.get("session") == "Unknown":
                val = t.data.get("openTime") or t.data.get("time")
                sess, msg = detect_session_debug(val)
                print(f"Ticket {t.ticket} | Val: {val} | Result: {sess} | Msg: {msg}")

if __name__ == "__main__":
    asyncio.run(debug())
