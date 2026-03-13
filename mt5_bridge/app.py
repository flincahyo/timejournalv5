"""
MT5 Bridge - TimeJournal
========================
Windows-only process. Monitors the MT5 terminal and pushes all
data to the backend REST API.

Flow:
  1. Every POLL_INTERVAL seconds, ask backend for active sessions
     (users who have connected via frontend).
  2. For each active session, log in to MT5 and push:
     - account info
     - trade history (full on first login, incremental after)
     - live positions
  3. Also push live prices for any symbols that have active alerts.
  4. On disconnect, clean up and log out of MT5.
"""

import os
import sys
import time
import logging
import asyncio

import httpx
import MetaTrader5 as mt5
from datetime import datetime, timedelta
from dotenv import load_dotenv

#  Config 
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("mt5_bridge")
logging.getLogger("httpx").setLevel(logging.WARNING)

_raw_host = os.getenv("MT5_BRIDGE_HOST", "http://localhost").rstrip("/")
BACKEND_HOST = _raw_host if _raw_host.startswith("http") else f"http://{_raw_host}"
BACKEND_PORT = os.getenv("MT5_BRIDGE_PORT", "8000")
BACKEND_URL = f"{BACKEND_HOST}:{BACKEND_PORT}"

BRIDGE_API_KEY = os.getenv("MT5_BRIDGE_API_KEY", "changeme_secret_key_123")
POLL_INTERVAL = int(os.getenv("MT5_POLL_INTERVAL", "10"))  # seconds

HEADERS = {"x-bridge-key": BRIDGE_API_KEY, "Content-Type": "application/json"}

#  Local state 
# Tracks which users have had their full history fetched this session.
# { user_id: { "login": int, "history_fetched": bool } }
_session_cache: dict = {}

# Currently logged-in MT5 account login number (None = not logged in)
_current_login: int | None = None


#  MT5 helpers 

def _account_summary() -> dict | None:
    """Return basic account info matching frontend MT5Account type."""
    acc = mt5.account_info()
    if not acc:
        return None
    return {
        "login": acc.login,
        "name": acc.name,
        "server": acc.server,
        "balance": acc.balance,
        "equity": acc.equity,
        "profit": acc.profit,
        "margin": acc.margin,
        "freeMargin": acc.margin_free,
        "leverage": acc.leverage,
        "currency": acc.currency,
    }


def _calc_pips(symbol: str, open_price: float, close_price: float, trade_type: str) -> float:
    """Calculate profit/loss in pips with support for various asset classes."""
    sym = symbol.upper()
    
    # Pip sizes based on common MT5 conventions
    if any(x in sym for x in ["BTC", "BITCOIN"]):
        pip_size = 1.0
    elif any(x in sym for x in ["ETH", "ETHEREUM"]):
        pip_size = 0.1
    elif any(x in sym for x in ["NAS", "US100", "DOW", "US30", "DAX", "GER"]):
        pip_size = 1.0
    elif any(x in sym for x in ["SPX", "US500"]):
        pip_size = 0.1
    elif any(x in sym for x in ["XAU", "GOLD"]):
        pip_size = 0.1
    elif any(x in sym for x in ["XAG", "SILVER"]):
        pip_size = 0.01
    elif any(x in sym for x in ["OIL", "WTI"]):
        pip_size = 0.01
    elif "JPY" in sym:
        pip_size = 0.01
    else:
        # Default for Forex
        pip_size = 0.0001
        
    diff = close_price - open_price if trade_type == "BUY" else open_price - close_price
    return round(diff / pip_size, 1) if pip_size else 0.0


def _fetch_history(full: bool) -> list:
    """Fetch closed deals. Full = all history; otherwise last 24h only."""
    date_from = datetime.now() - timedelta(days=3650 if full else 1)
    date_to = datetime.now() + timedelta(days=1)
    deals = mt5.history_deals_get(date_from, date_to) or []

    deals = mt5.history_deals_get(date_from, date_to) or []

    trades = []
    for d in deals:
        # Only include closing (OUT) trades
        if d.type not in (mt5.DEAL_TYPE_BUY, mt5.DEAL_TYPE_SELL):
            continue
        if d.entry != mt5.DEAL_ENTRY_OUT:
            continue

        # When a BUY trade closes, the closing deal type is SELL  flip back
        trade_type = "BUY" if d.type == mt5.DEAL_TYPE_SELL else "SELL"

        # Retrieve open price from the matching opening deal
        pos_deals = mt5.history_deals_get(position=d.position_id) or []
        open_deal = None
        for pd in pos_deals:
            if pd.entry == mt5.DEAL_ENTRY_IN:
                open_deal = pd
                break
        
        open_price = open_deal.price if open_deal else 0.0
        close_price = d.price

        pips = _calc_pips(d.symbol, open_price, close_price, trade_type) if open_price else 0.0
        net_pnl = d.profit + d.commission + d.swap

        # Use open_deal.time if found, otherwise fallback to closing deal time
        open_ts = open_deal.time if open_deal else d.time
        open_time = datetime.fromtimestamp(open_ts).isoformat()
        close_time = datetime.fromtimestamp(d.time).isoformat()

        # Map MT5 deal reason to frontend CloseType
        close_type = "manually_closed"
        if d.reason == mt5.DEAL_REASON_SL:
            close_type = "stopped_out"
        elif d.reason == mt5.DEAL_REASON_TP:
            close_type = "target_hit"

        trades.append({
            "id": str(d.ticket),
            "symbol": d.symbol,
            "type": trade_type,           # "BUY" or "SELL" (uppercase  matches frontend TradeDirection)
            "lots": d.volume,              # frontend uses t.lots
            "openPrice": open_price,
            "closePrice": close_price,
            "pnl": round(net_pnl, 2),      # frontend calcStats uses t.pnl
            "profit": round(d.profit, 2),  # raw profit before fees
            "commission": d.commission,
            "swap": d.swap,
            "pips": pips,
            "openTime": open_time,
            "closeTime": close_time,
            "status": "closed",            # lowercase matches TradeStatus type
            "session": "Unknown",
            "closeType": close_type,
        })
    return trades


def _fetch_positions() -> list | None:
    """Fetch all currently open positions and pending orders."""
    p_data = mt5.positions_get()
    o_data = mt5.orders_get()
    
    # If both are None, MT5 terminal might be busy or disconnected
    if p_data is None and o_data is None:
        return None
        
    live_items = []
    
    # 1. Open Positions
    for p in p_data or []:
        live_items.append({
            "id": str(p.ticket),
            "ticket": p.ticket,
            "symbol": p.symbol,
            "type": "BUY" if p.type == mt5.POSITION_TYPE_BUY else "SELL",
            "lots": p.volume,
            "openPrice": p.price_open,
            "currentPrice": p.price_current,
            "closePrice": p.price_current, # For frontend compatibility
            "pnl": round(p.profit, 2),
            "profit": round(p.profit, 2),
            "openTime": datetime.fromtimestamp(p.time).isoformat(),
            "status": "live",
            "session": "Unknown",
            "sl": p.sl,
            "tp": p.tp,
        })
        
    # 2. Pending Orders
    for o in o_data or []:
        # Map MT5 order types to string
        otype = "UNKNOWN"
        if o.type == mt5.ORDER_TYPE_BUY_LIMIT: otype = "BUY LIMIT"
        elif o.type == mt5.ORDER_TYPE_SELL_LIMIT: otype = "SELL LIMIT"
        elif o.type == mt5.ORDER_TYPE_BUY_STOP: otype = "BUY STOP"
        elif o.type == mt5.ORDER_TYPE_SELL_STOP: otype = "SELL STOP"
        elif o.type == mt5.ORDER_TYPE_BUY_STOP_LIMIT: otype = "BUY STOP LIMIT"
        elif o.type == mt5.ORDER_TYPE_SELL_STOP_LIMIT: otype = "SELL STOP LIMIT"
        elif o.type == mt5.ORDER_TYPE_BUY: otype = "BUY"
        elif o.type == mt5.ORDER_TYPE_SELL: otype = "SELL"
        
        live_items.append({
            "id": str(o.ticket),
            "ticket": o.ticket,
            "symbol": o.symbol,
            "type": otype,
            "lots": o.volume_current,
            "openPrice": o.price_open,      # Target Price
            "currentPrice": o.price_current,   # Current Market Price
            "closePrice": o.price_current,
            "pips": 0.0,
            "pnl": 0.0,
            "profit": 0.0,
            "openTime": datetime.fromtimestamp(o.time_setup).isoformat(),
            "status": "pending",
            "session": "Unknown",
            "sl": o.sl,
            "tp": o.tp,
        })
        
    return live_items


def _fetch_prices(symbols: list[str]) -> dict:
    """Return bid/ask for each symbol. Enables symbol in MT5 market watch if needed."""
    prices = {}
    for sym in symbols:
        if not mt5.symbol_select(sym, True):
            continue
        tick = mt5.symbol_info_tick(sym)
        if tick:
            prices[sym] = {
                "bid": tick.bid,
                "ask": tick.ask,
                "time": tick.time,
            }
    return prices


def _login(login: int, password: str, server: str) -> bool:
    """Log in to MT5. Returns True on success."""
    global _current_login
    mt5.shutdown()
    ok = mt5.initialize(login=login, password=password, server=server)
    if ok:
        _current_login = login
        log.info(f"[MT5] Logged in as {login} on {server}")
    else:
        _current_login = None
        log.error(f"[MT5] Login failed for {login}: {mt5.last_error()}")
    return ok


def _ensure_terminal_alive() -> bool:
    """Check if MT5 terminal process is responsive."""
    info = mt5.terminal_info()
    return info is not None


#  HTTP helpers 

async def _push(client: httpx.AsyncClient, payload: dict) -> bool:
    """POST a payload to /api/mt5/push. Returns True on success."""
    try:
        resp = await client.post(
            f"{BACKEND_URL}/api/mt5/push",
            json=payload,
            headers=HEADERS,
            timeout=8.0,
        )
        resp.raise_for_status()
        return True
    except Exception as e:
        log.warning(f"[push] Failed: {e}")
        return False


async def _push_prices(client: httpx.AsyncClient, prices: dict, candles: dict) -> bool:
    """POST price and candle data to /api/mt5/push-prices."""
    try:
        resp = await client.post(
            f"{BACKEND_URL}/api/mt5/push-prices",
            json={"prices": prices, "candles": candles},
            headers=HEADERS,
            timeout=8.0,
        )
        resp.raise_for_status()
        return True
    except Exception as e:
        log.warning(f"[push-prices] Failed: {e}")
        return False


async def _get_pending_sessions(client: httpx.AsyncClient) -> list:
    """Ask backend which users want an active MT5 connection."""
    try:
        resp = await client.get(
            f"{BACKEND_URL}/api/mt5/pending-connections",
            headers=HEADERS,
            timeout=8.0,
        )
        resp.raise_for_status()
        return resp.json().get("connections", [])
    except Exception as e:
        log.warning(f"[pending] Could not fetch sessions: {e}")
        return []


async def _get_alert_symbols(client: httpx.AsyncClient) -> list[str]:
    """Ask backend for symbols that need live price monitoring."""
    try:
        resp = await client.get(
            f"{BACKEND_URL}/api/mt5/alert-symbols",
            headers=HEADERS,
            timeout=8.0,
        )
        resp.raise_for_status()
        return resp.json().get("symbols", [])
    except Exception as e:
        log.debug(f"[alert-symbols] {e}")
        return []


#  Main loop 

async def main_loop():
    log.info(f"[ROCKET] MT5 Bridge starting  backend: {BACKEND_URL}  interval: {POLL_INTERVAL}s")

    async with httpx.AsyncClient() as client:
        # Start the fast price-pushing loop in the background (runs every 1.5s)
        asyncio.create_task(_price_loop(client))
        
        # Main cycle (trades, account info) runs every POLL_INTERVAL (10s)
        while True:
            try:
                await _cycle(client)
            except Exception as e:
                log.error(f"[cycle] Unhandled error: {e}")
            await asyncio.sleep(POLL_INTERVAL)


import websockets
import json

async def _price_loop(client: httpx.AsyncClient):
    """Fast loop to push current prices and candles via persistent WebSocket."""
    ws_host = BACKEND_URL.replace("http://", "ws://").replace("https://", "wss://")
    ws_url = f"{ws_host}/ws/bridge/prices?token={BRIDGE_API_KEY}"
    
    while True:
        try:
            async with websockets.connect(ws_url) as ws:
                log.info(f"[WS] Connected to {ws_url} for price streaming")
                while True:
                    if _current_login is not None:
                        # Re-fetch alert symbols every 10s or so. For simplicity, fetch every loop 
                        # (GET overhead is small, but can be optimized later).
                        alert_symbols = await _get_alert_symbols(client)
                        if alert_symbols:
                            prices = _fetch_prices(alert_symbols)
                            
                            candles = {}
                            for sym in alert_symbols:
                                for tf_name, tf_const in [("M1", mt5.TIMEFRAME_M1), ("M5", mt5.TIMEFRAME_M5)]:
                                    rates = mt5.copy_rates_from_pos(sym, tf_const, 0, 3)
                                    if rates is not None and len(rates) > 0:
                                        candles[f"{sym}_{tf_name}"] = [
                                            {
                                                "time": int(r["time"]),
                                                "open": float(r["open"]),
                                                "high": float(r["high"]),
                                                "low": float(r["low"]),
                                                "close": float(r["close"]),
                                            }
                                            for r in rates
                                        ]
        
                            if prices:
                                payload = json.dumps({"prices": prices, "candles": candles})
                                await ws.send(payload)
                    
                    await asyncio.sleep(1.0) # Faster 1.0s stream since WS is cheap
                    
        except websockets.exceptions.ConnectionClosed:
            log.warning("[WS] Disconnected from backend. Retrying in 5s...")
            await asyncio.sleep(5.0)
        except Exception as e:
            log.warning(f"[_price_loop] WS Error: {e}")
            await asyncio.sleep(5.0)


async def _cycle(client: httpx.AsyncClient):
    global _current_login, _session_cache

    #  Step 1: Get sessions the backend wants us to serve 
    sessions = await _get_pending_sessions(client)

    #  Step 2: Detect disconnected users and clean up 
    active_user_ids = {s["user_id"] for s in sessions}
    removed = set(_session_cache.keys()) - active_user_ids
    for uid in removed:
        log.info(f"[-] User {uid} disconnected  clearing session cache")
        del _session_cache[uid]

    # If no active sessions, shut down MT5 terminal to free resources
    if not sessions:
        if _ensure_terminal_alive():
            log.info("[MT5] No active sessions  shutting down terminal")
            mt5.shutdown()
            _current_login = None
        return

    #  Step 3: Ensure MT5 terminal is alive 
    if not _ensure_terminal_alive():
        if not mt5.initialize():
            log.error("[MT5] Terminal is not running or inaccessible")
            return

    #  Step 4: Process active session 
    # NOTE: MT5 only supports one active login at a time on Windows.
    # If there are multiple active users (e.g. local testing), we ONLY process 
    # the last requested session to prevent the terminal from ping-ponging between accounts.
    if sessions:
        session = sessions[-1]
        user_id = session["user_id"]
        req_login = int(session["login"])
        req_pw = session["password"]
        req_server = session["server"]

        cache = _session_cache.get(user_id, {})

        # Login if needed (different account or not logged in yet)
        if req_login != _current_login:
            success = _login(req_login, req_pw, req_server)
            if not success:
                await _push(client, {
                    "user_id": user_id,
                    "type": "error",
                    "message": f"MT5 login failed: {mt5.last_error()}",
                })
                return
            cache["history_fetched"] = False  # Need full re-sync on new login

        acc = _account_summary()
        if not acc:
            log.warning(f"[{user_id}] Could not read account info")
            return

        # Push connection confirmation + account state
        await _push(client, {"user_id": user_id, "type": "connected", "account": acc})

        # Push full symbol list once per session (market watch symbols)
        if not cache.get("symbols_pushed", False):
            raw_symbols = mt5.symbols_get() or []
            log.info(f"[{user_id}] Got {len(raw_symbols)} raw symbols from mt5.symbols_get()")
            symbol_names = sorted(set(
                s.name for s in raw_symbols if hasattr(s, 'name') and s.name
            ))
            log.info(f"[{user_id}] Extracted {len(symbol_names)} valid symbol names")
            if symbol_names:
                ok = await _push(client, {
                    "user_id": user_id,
                    "type": "symbols",
                    "symbols": symbol_names,
                })
                if ok:
                    cache["symbols_pushed"] = True
                    log.info(f"[{user_id}] Pushed {len(symbol_names)} symbols to backend")
                else:
                    log.warning(f"[{user_id}] Failed to push symbols to backend")

        # Fetch history  full on first connection, incremental after
        need_full = not cache.get("history_fetched", False)
        history = _fetch_history(full=need_full)
        positions = _fetch_positions()

        if need_full:
            log.info(f"[{user_id}] Full history: {len(history)} trades")
            ok = await _push(client, {
                "user_id": user_id,
                "type": "all_trades",
                "trades": history,
            })
            # Only mark as fetched if backend confirmed receipt  if push failed
            # (e.g. backend was restarting), retry full sync on next cycle
            if ok:
                cache["history_fetched"] = True
                log.info(f"[{user_id}] Full history push successful ({len(history)} trades)")
            else:
                log.warning(f"[{user_id}] Full history push failed  will retry next cycle")
        else:
            # Only push if there are new trades since last cycle
            if history:
                await _push(client, {
                    "user_id": user_id,
                    "type": "recent_trades",
                    "trades": history,
                })

        # Always push live positions and latest account info
        if positions is not None:
            await _push(client, {"user_id": user_id, "type": "live_trades", "trades": positions})
        await _push(client, {"user_id": user_id, "type": "account_update", "account": acc})

        # Update local cache
        cache["login"] = req_login
        _session_cache[user_id] = cache

    #  Step 5: (Moved to _price_loop for faster sync) 
    pass


#  Entry point 

if __name__ == "__main__":
    try:
        asyncio.run(main_loop())
    except KeyboardInterrupt:
        log.info("MT5 Bridge shutting down gracefully...")
        mt5.shutdown()
        sys.exit(0)