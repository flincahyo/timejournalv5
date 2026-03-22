"""
TimeJournal MT5 Backend v3
============================
FastAPI + WebSocket + PostgreSQL + JWT Auth
Per-user MT5 subprocess isolation

Install:
    pip install -r requirements.txt

Run:
    python main.py
"""

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Depends, Header, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any, Set
import datetime
import asyncio
import time
import json
import pytz
import os
import uuid
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from sqlalchemy import delete
import httpx

# Local imports
from database import init_db, get_db, User, MT5Account, Trade, JournalNote, JournalTag, DailyTag, Alert, AlertHistory, UserSettings, PublicShare
from auth import (
    hash_password, verify_password, create_access_token, decode_token, generate_id,
    encrypt_connection_password, decrypt_connection_password
)
from mt5_manager import mt5_manager

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified

load_dotenv()

WIB = pytz.timezone("Asia/Jakarta")

# ── xAI (Grok) ───────────────────────────────────────────────────────────────
try:
    from openai import OpenAI
    _api_key = os.getenv("XAI_API_KEY")
    if _api_key:
        ai_client = OpenAI(api_key=_api_key, base_url="https://api.x.ai/v1")
        XAI_AVAILABLE = True
        print("✅ xAI (Grok) loaded")
    else:
        ai_client = None
        XAI_AVAILABLE = False
        print("⚠ XAI_API_KEY not set")
except ImportError:
    ai_client = None
    XAI_AVAILABLE = False

# ── MT5 (Windows only) ───────────────────────────────────────────────────────
try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
    print("✅ MetaTrader5 library loaded")
except ImportError:
    MT5_AVAILABLE = False
    print("⚠ MetaTrader5 not available. Using subprocess worker mode.")

# ── WebSocket client registry {user_id: [WebSocket]} ─────────────────────────
_ws_clients: Dict[str, List[WebSocket]] = {}

# ── Price & Candle cache (updated by MT5 bridge push) ─────────────────────────
_price_cache: Dict[str, float] = {}  # {"XAUUSD": 2650.50, ...}
_candle_cache: Dict[str, list] = {}  # {"XAUUSD_M1": [{time, open, high, low, close}, ...], ...}
_alert_notified: Dict[str, float] = {}  # {"alert_id": last_notified_timestamp}
_watching_symbols: Dict[str, float] = {}  # {"SYMBOL": expiry_timestamp}

# ── News cache (updated hourly) ───────────────────────────────────────────────
_news_cache: List[dict] = []
_news_notified: Set[str] = set()

# ── Temporary tracked symbols (from frontend form typing) ─────────────────────


async def broadcast_to_user(user_id: str, msg: dict):
    dead = []
    for ws in _ws_clients.get(user_id, []):
        try:
            await ws.send_text(json.dumps(msg))
        except Exception:
            dead.append(ws)
    for ws in dead:
        _ws_clients[user_id].remove(ws)

async def broadcast_to_all(msg: dict):
    """Broadcasts a message to ALL currently connected WebSockets."""
    for user_id in list(_ws_clients.keys()):
        await broadcast_to_user(user_id, msg)

async def send_expo_push_notification(token: str, title: str, body: str, data: dict = None, sound: str = "default"):
    """Sends a push notification using Expo's push API."""
    if not token or not (token.startswith("ExponentPushToken") or token.startswith("ExpoPushToken")):
        print(f"DEBUG PUSH: Invalid token format: {token[:20]}...")
        return
    
    # If sound is a URL (custom upload), Expo might not play it directly as a system sound
    # unless it's bundled. But we set it in 'sound' field for Expo to try,
    # and also in 'data' for the app to play when in foreground.
    message = {
        "to": token,
        "sound": "default", # Use system default for the notification sound slot
        "title": title,
        "body": body,
        "data": {**(data or {}), "sound": sound}, # Pass the specific sound name in data
        "priority": "high",
        "channelId": "default"
    }
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json=message,
                headers={"Accept": "application/json", "Accept-encoding": "gzip, deflate", "Content-Type": "application/json"}
            )
            print(f"DEBUG PUSH: Sent notification to {token}: {response.json()}")
    except Exception as e:
        print(f"DEBUG PUSH: Error sending push notification: {e}")


async def sync_trade_to_journal(user_id: str, trade_data: dict, db: AsyncSession):
    """Sync trade setup and emotion to journal tags for that day."""
    from database import JournalTag, DailyTag
    
    setup = trade_data.get("setup")
    emotion = trade_data.get("emotion")
    timestamp = trade_data.get("openTime") or trade_data.get("time")
    if not timestamp or (not setup and not emotion):
        return
        
    day = timestamp.split('T')[0]
    tags_to_add = [t for t in [setup, emotion] if t and t.strip()]
    print(f"DEBUG SYNC: User {user_id}, Day {day}, Tags {tags_to_add}")
    
    for tag_name in tags_to_add:
        tag_name = tag_name.strip()
        
        # 1. Ensure it exists in master JournalTag list
        res = await db.execute(select(JournalTag).where(JournalTag.user_id == user_id, JournalTag.name == tag_name))
        if not res.scalar_one_or_none():
            print(f"DEBUG SYNC: Adding to master JournalTag: {tag_name}")
            db.add(JournalTag(user_id=user_id, name=tag_name))
            
        # 2. Ensure it exists in DailyTag for that day
        res_d = await db.execute(select(DailyTag).where(DailyTag.user_id == user_id, DailyTag.day == day, DailyTag.tag == tag_name))
        if not res_d.scalar_one_or_none():
            print(f"DEBUG SYNC: Adding to DailyTag: {tag_name} for {day}")
            db.add(DailyTag(user_id=user_id, day=day, tag=tag_name))
    
    await db.flush()


def detect_session(dt_val):
    """Detects Forex trading session based on timestamp."""
    if not dt_val:
        return "Unknown"
    try:
        dt_utc = None
        # Handle WIB string or ISO string
        if isinstance(dt_val, str):
            dt_str = dt_val.strip()
            # Replace common non-ISO separators
            dt_str = dt_str.replace(" ", "T").replace("/", "-").replace(".", "-")
            
            if dt_str.endswith("Z"):
                dt_utc = datetime.datetime.fromisoformat(dt_str.replace("Z", "+00:00")).astimezone(pytz.UTC)
            elif "+" in dt_str or ("-" in dt_str[10:] and len(dt_str) > 10): # Has offset
                dt_utc = datetime.datetime.fromisoformat(dt_str).astimezone(pytz.UTC)
            elif len(dt_str) >= 19:
                dt_naive = datetime.datetime.fromisoformat(dt_str[:19])
                # Default to WIB if no offset (worker convention), otherwise fallback to UTC
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

        # Session Hours based on user screenshot (WIB)
        # Convert UTC hour to WIB hour (Jakarta Time)
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
    except Exception as e:
        print(f"DEBUG SESSION: Error detecting session for {dt_val}: {e}")
        return "Unknown"


# ── MT5 worker callback ───────────────────────────────────────────────────────
async def on_mt5_message(user_id: str, msg: dict):
    """Called by MT5WorkerProcess when data arrives. Saves to DB and broadcasts."""
    msg_type = msg.get("type")
    
    async with AsyncSessionLocal() as db:
        # Find the ACTIVE MT5 account for this user to associate data
        res0 = await db.execute(select(MT5Account).where(MT5Account.user_id == user_id, MT5Account.is_active == True))
        active_acc = res0.scalar_one_or_none()
        
        if not active_acc:
            print(f"⚠ DEBUG MT5: No active account found for user {user_id}. Cannot sync.")
            return
            
        mt5_login = active_acc.login
        
        # Sync Strategy: Find ALL users sharing THIS SAME MT5 login (e.g., demo/ceklogin)
        res1 = await db.execute(select(MT5Account).where(MT5Account.login == mt5_login, MT5Account.is_active == True))
        target_accounts = res1.scalars().all()
        
    print(f"DEBUG MT5: Received {msg_type} for login {mt5_login} (Syncing accounts: {[a.id for a in target_accounts]})")

    for acc in target_accounts:
        uid = acc.user_id
        aid = acc.id
        
        if msg_type in ("all_trades", "history_batch", "recent_trades", "history"):
            async with AsyncSessionLocal() as db:
                trades = msg.get("trades", [])
                print(f"DEBUG MT5: Persisting {len(trades)} trades for account {aid} (user {uid})")
                for t in trades:
                    ticket = str(t["id"])
                    # Calculate session first
                    timestamp = t.get("openTime") or t.get("open_time") or t.get("time")
                    detected_session = detect_session(timestamp)
                    
                    # Check if trade exists for THIS specific account
                    res_t = await db.execute(select(Trade).where(Trade.ticket == ticket, Trade.account_id == aid))
                    existing = res_t.scalar_one_or_none()
                    if existing:
                        # MERGE: Preserve manual fields from existing data
                        old_data = existing.data or {}
                        
                        # Preserve an already correct session
                        if old_data.get("session") and old_data.get("session") != "Unknown":
                            t["session"] = old_data.get("session")
                        else:
                            t["session"] = detected_session
                            
                        for field in ["setup", "emotion", "notes", "note", "tags"]:
                            if old_data.get(field) and not t.get(field):
                                t[field] = old_data[field]
                        
                        existing.data = t
                        existing.synced_at = datetime.datetime.utcnow()
                        from sqlalchemy.orm.attributes import flag_modified
                        flag_modified(existing, "data")
                        
                        # SYNC to journal tags
                        await sync_trade_to_journal(uid, t, db)
                    else:
                        t["session"] = detected_session
                        db.add(Trade(ticket=ticket, account_id=aid, user_id=uid, data=t))
                        # NEW trade sync if it has setup/emotion (unlikely but possible)
                        await sync_trade_to_journal(uid, t, db)
                
                # Update account sync time
                target_acc = await db.get(MT5Account, aid)
                if target_acc:
                    target_acc.last_sync = datetime.datetime.utcnow()
                    
                await db.commit()
            await broadcast_to_user(uid, msg)

        elif msg_type == "new_trade":
            async with AsyncSessionLocal() as db:
                t = msg["trade"]
                ticket = str(t["id"])
                res_t = await db.execute(select(Trade).where(Trade.ticket == ticket, Trade.account_id == aid))
                existing = res_t.scalar_one_or_none()
                if not existing:
                    if "session" not in t or t.get("session") == "Unknown":
                        t["session"] = detect_session(t.get("openTime") or t.get("time"))
                    db.add(Trade(ticket=ticket, account_id=aid, user_id=uid, data=t))
                    await db.commit()
                else:
                    # UPDATE existing trade (e.g. when it closes)
                    old_data = existing.data or {}
                    
                    if old_data.get("session") and old_data.get("session") != "Unknown":
                        t["session"] = old_data.get("session")
                    elif "session" not in t or t.get("session") == "Unknown":
                         t["session"] = detect_session(t.get("openTime") or t.get("time"))
                    
                    # MERGE: Preserve manual fields
                    for field in ["setup", "emotion", "notes", "note", "tags"]:
                        if old_data.get(field) and not t.get(field):
                            t[field] = old_data[field]
                    
                    existing.data = t
                    existing.synced_at = datetime.datetime.utcnow()
                    from sqlalchemy.orm.attributes import flag_modified
                    flag_modified(existing, "data")
                    
                    # SYNC to journal tags
                    await sync_trade_to_journal(uid, t, db)
                    await db.commit()
                    
                    # Expo Push
                    settings = await db.get(UserSettings, uid)
                    if settings and settings.expo_push_token:
                        sym = t.get("symbol", "Unknown")
                        side = t.get("type", "TRADE")
                        lots = t.get("lots", t.get("volume", 0))
                        status = t.get("status", "live")
                        title = f"Trade {'Closed' if status.lower() == 'closed' else 'Opened'}: {sym}"
                        body = f"{side} {lots} at {t.get('openPrice', 0)}"
                        asyncio.create_task(send_expo_push_notification(settings.expo_push_token, title, body, t))
            await broadcast_to_user(uid, msg)

        elif msg_type in ("live_trades", "account_update", "error", "connected", "symbols"):
            if msg_type == "account_update":
                async with AsyncSessionLocal() as db:
                    target_acc = await db.get(MT5Account, aid)
                    if target_acc:
                        target_acc.account_info = msg.get("account", {})
                        target_acc.last_sync = datetime.datetime.utcnow()
                        await db.commit()
            elif msg_type == "symbols":
                async with AsyncSessionLocal() as db:
                    target_acc = await db.get(MT5Account, aid)
                    if target_acc:
                        target_acc.symbols = msg.get("symbols", [])
                        target_acc.last_sync = datetime.datetime.utcnow()
                        from sqlalchemy.orm.attributes import flag_modified
                        flag_modified(target_acc, "symbols")
                        await db.commit()
            await broadcast_to_user(uid, msg)


# Lazy import for session
from database import AsyncSessionLocal

# ── App lifespan ──────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    from database import DATABASE_URL
    # Mask password for security
    masked_url = DATABASE_URL
    if "@" in DATABASE_URL:
        base, rest = DATABASE_URL.split("@", 1)
        if ":" in base:
            proto, creds = base.split("://", 1)
            masked_url = f"{proto}://***:***@{rest}"
    
    print(f"📡 Connecting to database: {masked_url}")
    try:
        await asyncio.wait_for(init_db(), timeout=20.0)
        print("✅ Database initialized successfully")
    except asyncio.TimeoutError:
        print("❌ Database initialization TIMEOUT (check your PostgreSQL connectivity)")
    except Exception as e:
        print(f"❌ Database initialization FAILED: {e}")
    
    # Start alert evaluator background task
    evaluator_task = asyncio.create_task(_alert_evaluator_loop())
    print("🔔 Alert evaluator started")
    
    # Start news evaluator background task
    news_task = asyncio.create_task(_news_evaluator_loop())
    print("📰 News evaluator started")
    
    yield
    
    evaluator_task.cancel()
    news_task.cancel()
    await mt5_manager.shutdown_all()


app = FastAPI(title="TimeJournal MT5 API v3", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://timejournal.site",
        "https://api.timejournal.site",
        "http://localhost:3000",
        "http://localhost:8000"
    ] + os.getenv("ALLOWED_ORIGINS", "").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads static folder
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

security = HTTPBearer(auto_error=False)


# ── Auth helpers ──────────────────────────────────────────────────────────────
async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not credentials:
        print("DEBUG AUTH: No credentials found in request")
        raise HTTPException(status_code=401, detail="Not authenticated")
    print(f"DEBUG AUTH: Token found: {credentials.credentials[:10]}...")
    payload = decode_token(credentials.credentials)
    if not payload:
        print("DEBUG AUTH: Token decoding failed")
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user_id = payload.get("sub")
    if not user_id:
        print("DEBUG AUTH: No sub in payload")
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = await db.get(User, user_id)
    if not user:
        print(f"DEBUG AUTH: User {user_id} not found in DB")
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return user_id


# ── Auth Models ───────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    image: Optional[str] = None

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class TradeMetadataUpdate(BaseModel):
    setup: Optional[str] = None
    emotion: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[list[str]] = None

class RecapSettingsUpdate(BaseModel):
    enabled: Optional[bool] = None
    emotion_choices: Optional[list[str]] = None
    setup_choices: Optional[list[str]] = None
    profit_sound: Optional[str] = None
    loss_sound: Optional[str] = None


# ── Auth Endpoints ────────────────────────────────────────────────────────────
@app.post("/api/auth/register")
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Nama tidak boleh kosong")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password minimal 6 karakter")

    key = req.email.lower().strip()
    result = await db.execute(select(User).where(User.email == key))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email sudah terdaftar. Silakan login.")

    user = User(
        id=generate_id(),
        email=key,
        name=req.name.strip(),
        hashed_password=hash_password(req.password),
        created_at=datetime.datetime.utcnow(),
    )
    # Default settings
    settings = UserSettings(
        user_id=user.id,
        theme="light",
        news_settings={
            "enabled": False, "currencies": ["USD"],
            "impacts": ["High"], "minutesBefore": 5
        },
        recap_settings={
            "enabled": True,
            "emotion_choices": ["Confident", "Anxious", "Neutral", "Revengeful", "Greedy", "Fearful"],
            "setup_choices": ["A+ Setup", "Followed Plan", "FOMO Entry", "Early Exit", "Poor R:R", "Chasing Price"],
            "profit_sound": "default_profit",
            "loss_sound": "default_loss"
        }
    )
    # Default journal tags
    default_tags = ["Followed Plan", "FOMO", "Revenge Trading", "Impatient", "Good Setup", "News Event"]
    tag_rows = [JournalTag(user_id=user.id, name=t) for t in default_tags]

    db.add(user)
    db.add(settings)
    for t in tag_rows:
        db.add(t)
    await db.commit()

    token = create_access_token({"sub": user.id})
    return {
        "token": token,
        "user": {"id": user.id, "email": user.email, "name": user.name, "createdAt": user.created_at.isoformat()},
    }


@app.post("/api/auth/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    key = req.email.lower().strip()
    result = await db.execute(select(User).where(User.email == key))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email atau password salah")

    token = create_access_token({"sub": user.id})
    # Get user settings
    settings_res = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
    settings = settings_res.scalar_one_or_none()
    
    return {
        "token": token,
        "user": {"id": user.id, "email": user.email, "name": user.name, "image": user.image, "createdAt": user.created_at.isoformat()},
        "settings": settings.to_dict() if settings else None
    }



@app.get("/api/auth/me")
async def get_me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    settings_res = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
    settings = settings_res.scalar_one_or_none()
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "image": user.image,
        "createdAt": user.created_at.isoformat(),
        "settings": settings.to_dict() if settings else None
    }


@app.put("/api/auth/profile")
async def update_profile(req: ProfileUpdateRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if req.name is not None:
        user.name = req.name.strip()
    if req.email is not None:
        user.email = req.email.lower().strip()
    if req.image is not None:
        user.image = req.image
    
    await db.commit()
    await db.refresh(user)
    return {"id": user.id, "email": user.email, "name": user.name, "image": user.image, "createdAt": user.created_at.isoformat()}


@app.put("/api/auth/password")
async def change_password(req: PasswordChangeRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not verify_password(req.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Password lama salah")
    
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password baru minimal 6 karakter")
        
    user.hashed_password = hash_password(req.new_password)
    await db.commit()
    return {"ok": True, "message": "Password berhasil diganti"}


@app.post("/api/auth/upload-avatar")
async def upload_avatar(file: UploadFile = File(...), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Ensure uploads directory exists
    os.makedirs("uploads", exist_ok=True)
    
    # Generate unique filename
    ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join("uploads", filename)
    
    with open(filepath, "wb") as f:
        f.write(await file.read())
    
    # Accessible via static mount
    url = f"/uploads/{filename}"
    
    # Optional: Update user image
    user.image = url
    await db.commit()
    return {"id": user.id, "url": url}


@app.post("/api/auth/upload-sound")
async def upload_sound(file: UploadFile = File(...), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    os.makedirs("uploads/sounds", exist_ok=True)
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".mp3", ".wav", ".ogg", ".m4a"]:
        raise HTTPException(status_code=400, detail="Unsupported audio format")

    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join("uploads/sounds", filename)
    with open(filepath, "wb") as f:
        f.write(await file.read())
    
    url = f"/uploads/sounds/{filename}"
    
    # Save to user settings
    res = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
    settings = res.scalar_one_or_none()
    if not settings:
        settings = UserSettings(user_id=user.id)
        db.add(settings)
    
    audio = settings.audio_settings or {}
    custom = audio.get("custom_sounds", [])
    new_sound = {"id": url, "name": file.filename, "url": url}
    custom.append(new_sound)
    audio["custom_sounds"] = custom
    settings.audio_settings = audio
    
    await db.commit()
    return new_sound


@app.get("/api/auth/sounds")
async def get_sounds(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
    settings = res.scalar_one_or_none()
    if not settings: return {"custom_sounds": []}
    return {"custom_sounds": (settings.audio_settings or {}).get("custom_sounds", [])}


@app.delete("/api/auth/sounds")
async def delete_sound(sound_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
    settings = res.scalar_one_or_none()
    if not settings: return {"ok": False}
    
    audio = settings.audio_settings or {}
    custom = audio.get("custom_sounds", [])
    filtered = [s for s in custom if s["id"] != sound_id]
    audio["custom_sounds"] = filtered
    settings.audio_settings = audio
    await db.commit()
    return {"ok": True}


@app.get("/api/auth/settings")
async def get_settings(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = UserSettings(user_id=user.id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    
    return {
        "theme": settings.theme,
        "news_settings": settings.news_settings,
        "recap_settings": settings.recap_settings,
        "terminal_layout": settings.terminal_layout
    }


@app.patch("/api/auth/settings/recap")
async def update_recap_settings(req: RecapSettingsUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
    settings = result.scalar_one_or_none()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    
    current = dict(settings.recap_settings or {})
    if req.enabled is not None: current["enabled"] = req.enabled
    if req.emotion_choices is not None: current["emotion_choices"] = req.emotion_choices
    if req.setup_choices is not None: current["setup_choices"] = req.setup_choices
    if req.profit_sound is not None: current["profit_sound"] = req.profit_sound
    if req.loss_sound is not None: current["loss_sound"] = req.loss_sound
    
    settings.recap_settings = current
    await db.commit()
    return {"ok": True, "settings": current}


@app.patch("/api/trades/{ticket}")
async def update_trade_metadata(ticket: str, req: TradeMetadataUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Update trade metadata like setup, emotion, notes."""
    # Find trade across all accounts and ensure it belongs to user
    result = await db.execute(select(Trade).where(Trade.ticket == ticket, Trade.user_id == user.id))
    trade = result.scalar_one_or_none()
    
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    # Update JSONB data field
    data = dict(trade.data)
    if req.setup is not None: data["setup"] = req.setup
    if req.emotion is not None: data["emotion"] = req.emotion
    if req.notes is not None: 
        data["notes"] = req.notes
        data["note"] = req.notes # Ensure compatibility with both field names
    if req.tags is not None: data["tags"] = req.tags
    
    trade.data = data
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(trade, "data")
    
    # SYNC to journal tags
    await sync_trade_to_journal(user.id, data, db)
    
    await db.commit()
    return {"ok": True, "trade": trade.data}


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "time": datetime.datetime.now(tz=WIB).isoformat()}

# Removed duplicate get_me definition (already at 560)


# ── MT5 Models ────────────────────────────────────────────────────────────────
class ConnectRequest(BaseModel):
    login: int
    password: str
    server: str
    port: int = 443


# ── MT5 Endpoint: Connect (per user) ─────────────────────────────────────────
@app.post("/api/mt5/connect")
async def connect_mt5(
    req: ConnectRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Encrypt password for DB storage
    encrypted_pw = encrypt_connection_password(req.password)

    # Deactivate ALL existing accounts for this user (Bridge limit: only one login per user active at a time)
    # But we DON'T delete trades anymore.
    result = await db.execute(select(MT5Account).where(MT5Account.user_id == user.id))
    all_accounts = result.scalars().all()
    
    for acc in all_accounts:
        acc.is_active = False

    # Find if THIS specific login/server combination already exists for this user
    result = await db.execute(
        select(MT5Account).where(MT5Account.user_id == user.id, MT5Account.login == req.login, MT5Account.server == req.server)
    )
    same_acc = result.scalar_one_or_none()
    
    if same_acc:
        same_acc.encrypted_password = encrypted_pw
        same_acc.is_active = True
        active_acc = same_acc
    else:
        active_acc = MT5Account(
            user_id=user.id,
            login=req.login,
            server=req.server,
            encrypted_password=encrypted_pw,
            is_active=True,
        )
        db.add(active_acc)
    
    await db.commit()
    await db.refresh(active_acc)

    print(f"DEBUG MT5: Account {active_acc.id} (login {req.login}) set to ACTIVE for user {user.id}")

    # Return cached trades from DB for THIS specific account
    result = await db.execute(select(Trade).where(Trade.account_id == active_acc.id))
    cached_trades = [r.data for r in result.scalars().all()]

    return {
        "success": True,
        "message": f"Connecting to {req.server}... MT5 worker started.",
        "trades": sorted(cached_trades, key=lambda x: x.get("openTime", ""), reverse=True),
        "live_trades": [],
        "total": len(cached_trades),
    }


@app.post("/api/mt5/disconnect")
async def disconnect_mt5(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # In permanent persistence model, we just deactivate without deleting trades
    result = await db.execute(
        select(MT5Account).where(MT5Account.user_id == user.id, MT5Account.is_active == True)
    )
    active_accounts = result.scalars().all()
    for acc in active_accounts:
        acc.is_active = False
        
    await db.commit()
    return {"success": True}


# ── Push Architecture Endpoints ───────────────────────────────────────────────

BRIDGE_KEY = os.getenv("MT5_BRIDGE_API_KEY", "changeme_secret_key_123")

def verify_bridge_key(x_bridge_key: str = Header(default="")):
    if x_bridge_key != BRIDGE_KEY:
        raise HTTPException(status_code=401, detail="Invalid bridge key")

@app.get("/api/mt5/pending-connections")
async def get_pending_connections(
    x_bridge_key: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    """
    Called by MT5 Bridge on Windows.
    Returns list of active MT5 sessions so bridge knows which users to serve.
    """
    if x_bridge_key != BRIDGE_KEY:
        raise HTTPException(status_code=401, detail="Invalid bridge key")

    result = await db.execute(
        select(MT5Account).where(MT5Account.is_active == True)
    )
    active_accounts = result.scalars().all()
    connections = []
    for a in active_accounts:
        password = decrypt_connection_password(a.encrypted_password)
        if password:
            connections.append({
                "user_id": a.user_id,
                "login": a.login,
                "server": a.server,
                "password": password,
            })
    return {"connections": connections}


class MT5PushPayload(BaseModel):
    user_id: str
    type: str               # "connected" | "all_trades" | "live_trades" | "account_update" | "error" | "symbols"
    trades: list = []
    account: dict = {}
    message: str = ""
    symbols: list = []

@app.post("/api/mt5/push")
async def receive_mt5_push(
    payload: MT5PushPayload,
    x_bridge_key: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    """
    Called by MT5 Bridge on Windows.
    Receives pushed trade/position/account data and broadcasts to user WebSockets.
    """
    if x_bridge_key != BRIDGE_KEY:
        raise HTTPException(status_code=401, detail="Invalid bridge key")

    # Cache latest prices from live trades
    for trade in payload.trades:
        symbol = trade.get("symbol")
        price = trade.get("priceCurrent") or trade.get("currentPrice")
        if symbol and price:
            _price_cache[symbol] = float(price)

    msg = {
        "type": payload.type,
        "trades": payload.trades,
        "account": payload.account,
        "message": payload.message,
        "symbols": payload.symbols,
    }
    # Re-use existing on_mt5_message handler — same as pull model
    await on_mt5_message(payload.user_id, msg)
    return {"ok": True}


# ── Push Prices/Candles from Bridge ───────────────────────────────────────────
class PricePushPayload(BaseModel):
    prices: Dict[str, float] = {}  # {"XAUUSD": 2650.50}
    candles: Dict[str, list] = {}  # {"XAUUSD_M1": [{time,open,high,low,close}]}

@app.post("/api/mt5/push-prices")
async def receive_price_push(
    payload: PricePushPayload,
    x_bridge_key: str = Header(default=""),
):
    """Receives latest prices and candle data from MT5 Bridge."""
    if x_bridge_key != BRIDGE_KEY:
        raise HTTPException(status_code=401, detail="Invalid bridge key")
    
    _price_cache.update(payload.prices)
    _candle_cache.update(payload.candles)
    
    # Broadcast to all users for real-time UI updates
    asyncio.create_task(broadcast_to_all({
        "type": "prices",
        "prices": payload.prices,
        "candles": payload.candles
    }))
    
    return {"ok": True, "cached_symbols": len(_price_cache)}


# ── Push Token Endpoint ───────────────────────────────────────────────────────
class PushTokenRequest(BaseModel):
    token: str

@app.post("/api/push-token")
async def register_push_token(
    req: PushTokenRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register Expo push token for the current user."""
    print(f"DEBUG push-token POST: user={user.id}, token={req.token[:30]}...")
    s = await db.get(UserSettings, user.id)
    if not s:
        s = UserSettings(user_id=user.id, theme="light", news_settings={})
        db.add(s)
    s.expo_push_token = req.token
    s.updated_at = datetime.datetime.utcnow()
    await db.commit()
    print(f"🔔 Push token registered for user {user.id}: {req.token[:30]}...")
    return {"ok": True}

@app.get("/api/push-token")
async def get_push_token(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Debug: Check the current push token for the authenticated user."""
    s = await db.get(UserSettings, user.id)
    token = s.expo_push_token if s else None
    print(f"DEBUG push-token GET: user={user.id}, has_token={bool(token)}")
    return {"ok": True, "has_token": bool(token), "token_preview": token[:20] + '...' if token else None}


@app.get("/api/mt5/symbols")
async def get_mt5_symbols(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns the list of available symbols for the user's active account."""
    result = await db.execute(
        select(MT5Account).where(MT5Account.user_id == user.id, MT5Account.is_active == True)
    )
    acc = result.scalar_one_or_none()
    if not acc:
        return {"symbols": []}
    return {"symbols": acc.symbols or []}




@app.get("/api/mt5/status")
async def mt5_status(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MT5Account).where(MT5Account.user_id == user.id, MT5Account.is_active == True)
    )
    active_accounts = result.scalars().all()
    acc = active_accounts[0] if active_accounts else None
    
    is_connected = False
    if acc:
        if acc.last_sync:
            delta = datetime.datetime.utcnow() - acc.last_sync
            if delta.total_seconds() < 120:
                is_connected = True
        else:
            is_connected = True

    return {
        "connected": is_connected,
        "account": acc.account_info if acc else None,
        "lastSync": acc.last_sync.isoformat() if acc and acc.last_sync else None,
        "login": acc.login if acc else None,
        "server": acc.server if acc else None,
        "accountId": acc.id if acc else None,
    }

@app.get("/api/mt5/alert-symbols")
async def get_alert_symbols(
    x_bridge_key: str = Header(default=""),
    db: AsyncSession = Depends(get_db)
):
    """Returns a list of symbols that have active price/candle alerts so the bridge can track them."""
    if x_bridge_key != BRIDGE_KEY:
        raise HTTPException(status_code=401, detail="Invalid bridge key")
    
    result = await db.execute(select(Alert).where(Alert.enabled == True))
    alerts = result.scalars().all()
    
    symbols = set()
    for a in alerts:
        sym = a.data.get("symbol")
        if sym: symbols.add(sym)
        
    # Also include symbols temporarily watched by users in the UI
    # They expire 30 seconds after the UI stops polling them
    current_time = time.time()
    active_watched = [sym for sym, expires in _watching_symbols.items() if current_time < expires]
    symbols.update(active_watched)
        
    return {"symbols": list(symbols)}
    
@app.post("/api/mt5/watch/{symbol}")
async def watch_symbol(symbol: str, user: User = Depends(get_current_user)):
    """Temporarily watch a symbol for real-time price updates in the UI."""
    _watching_symbols[symbol.upper()] = time.time() + 60  # Watch for 60 seconds
    return {"ok": True}


@app.get("/api/mt5/trades")
async def get_trades(
    account_id: Optional[int] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # If account_id is provided, fetch for that account; otherwise fetch for currently ACTIVE account
    if account_id:
        result = await db.execute(select(Trade).where(Trade.user_id == user.id, Trade.account_id == account_id))
    else:
        # Fallback to active account
        res_acc = await db.execute(select(MT5Account.id).where(MT5Account.user_id == user.id, MT5Account.is_active == True))
        aid = res_acc.scalar_one_or_none()
        if not aid:
            return {"trades": [], "total": 0}
        result = await db.execute(select(Trade).where(Trade.account_id == aid))

    trades = [r.data for r in result.scalars().all()]
    return {"trades": sorted(trades, key=lambda x: x.get("openTime", ""), reverse=True), "total": len(trades)}


class TradeUpdateRequest(BaseModel):
    setup: Optional[str] = None
    emotion: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[str] = None

@app.patch("/api/mt5/trades/{ticket}")
async def update_trade(
    ticket: str,
    req: TradeUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Updates custom metadata (setup, emotion, notes) for an MT5 trade."""
    result = await db.execute(select(Trade).where(Trade.user_id == user.id, Trade.ticket == ticket))
    trade = result.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    data = dict(trade.data)
    if req.setup is not None: data["setup"] = req.setup
    if req.emotion is not None: data["emotion"] = req.emotion
    if req.notes is not None: 
        data["notes"] = req.notes
        data["note"] = req.notes # Sync field names
    if req.tags is not None: data["tags"] = req.tags
    
    trade.data = data
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(trade, "data")
    
    # SYNC to journal tags
    await sync_trade_to_journal(user.id, data, db)
    
    await db.commit()
    return {"ok": True, "trade": trade.data}


# ── Account Management ────────────────────────────────────────────────────────
@app.get("/api/accounts")
async def list_accounts(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MT5Account).where(MT5Account.user_id == user.id).order_by(MT5Account.created_at.desc()))
    accounts = []
    for a in result.scalars().all():
        accounts.append({
            "id": a.id,
            "login": a.login,
            "server": a.server,
            "isActive": a.is_active,
            "lastSync": a.last_sync.isoformat() if a.last_sync else None,
            "accountInfo": a.account_info
        })
    return {"accounts": accounts}

@app.delete("/api/accounts/{account_id}")
async def delete_account(account_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Verify ownership
    result = await db.execute(select(MT5Account).where(MT5Account.id == account_id, MT5Account.user_id == user.id))
    acc = result.scalar_one_or_none()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Cascade delete is handled by SQLAlchemy relationship (cascade="all, delete-orphan")
    await db.delete(acc)
    await db.commit()
    return {"success": True, "message": f"Account {acc.login} and all its data deleted."}

@app.post("/api/accounts/{account_id}/toggle")
async def toggle_account_active(account_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Deactivate others
    await db.execute(update(MT5Account).where(MT5Account.user_id == user.id).values(is_active=False))
    # Activate target
    result = await db.execute(select(MT5Account).where(MT5Account.id == account_id, MT5Account.user_id == user.id))
    acc = result.scalar_one_or_none()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    acc.is_active = True
    await db.commit()
    return {"success": True, "isActive": True}


# ── Public Sharing ────────────────────────────────────────────────────────────
class ShareRequest(BaseModel):
    account_id: Optional[int] = None
    slug: str
    type: str  # 'dashboard' | 'calendar'
    settings: dict = {}

@app.get("/api/share/list")
async def list_shares(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(PublicShare).where(PublicShare.user_id == user.id))
    shares = res.scalars().all()
    return {"shares": shares}

@app.delete("/api/share/{id}")
async def delete_share(id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    share = await db.get(PublicShare, id)
    if not share or share.user_id != user.id:
        raise HTTPException(status_code=404, detail="Share not found")
    await db.delete(share)
    await db.commit()
    return {"ok": True}

@app.post("/api/share")
async def create_share(req: ShareRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Check if slug exists
    res = await db.execute(select(PublicShare).where(PublicShare.slug == req.slug))
    if res.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Slug already taken")
    
    share = PublicShare(
        id=str(uuid.uuid4()),
        user_id=user.id,
        account_id=req.account_id,
        slug=req.slug,
        type=req.type,
        settings=req.settings
    )
    db.add(share)
    await db.commit()
    return {"ok": True, "slug": req.slug}

@app.get("/api/public/share/{slug}")
async def get_public_share(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PublicShare).where(PublicShare.slug == slug, PublicShare.is_active == True)
    )
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")
    
    # Fetch data associated with this share
    # We return the user name, and the trades/notes for the specific account or all
    res_user = await db.get(User, share.user_id)
    
    trades_query = select(Trade)
    if share.account_id:
        trades_query = trades_query.where(Trade.account_id == share.account_id)
    else:
        trades_query = trades_query.where(Trade.user_id == share.user_id)
    
    res_trades = await db.execute(trades_query)
    trades_raw = res_trades.scalars().all()
    trades = []
    for t in trades_raw:
        d = t.data
        if "session" not in d:
            d["session"] = detect_session(d.get("openTime") or d.get("time"))
        trades.append(d)
    
    # Filter trades if settings are provided (e.g. only show last 30 days)
    # [TBD: Implement specialized filtering based on share.settings]

    # Fetch account info if a specific account is linked
    account_data = None
    if share.account_id:
        acc = await db.get(MT5Account, share.account_id)
        if acc:
            account_data = {
                "login": acc.login,
                "server": acc.server,
                "account_info": acc.account_info
            }

    return {
        "slug": slug,
        "type": share.type,
        "owner": res_user.name,
        "owner_image": res_user.image,
        "trades": sorted(trades, key=lambda x: x.get("openTime", ""), reverse=True),
        "account": account_data,
        "settings": share.settings
    }


# ── Candles (proxy to MT5 worker — only on Windows) ──────────────────────────
class CandleRequestItem(BaseModel):
    symbol: str
    timeframe: str

class CandlesRequest(BaseModel):
    items: List[CandleRequestItem]

@app.post("/api/candles")
async def get_candles(req: CandlesRequest, user: User = Depends(get_current_user)):
    results = []
    
    for item in req.items:
        # Register the symbol so the MT5 bridge starts pushing its prices (expires in 30s)
        _watching_symbols[item.symbol.upper()] = time.time() + 30.0
        
        # Check global cache from push bridge (Format: "XAUUSD_M1")
        cache_key = f"{item.symbol}_{item.timeframe.upper()}"
        if cache_key in _candle_cache:
            results.append({
                "symbol": item.symbol,
                "timeframe": item.timeframe.upper(),
                "candles": _candle_cache[cache_key]
            })
            continue

        # Fallback to local MT5 (Deprecated in push model, but kept for legacy logic)
        # In push model, we rely purely on the bridge pushing to _candle_cache.
        if MT5_AVAILABLE:
            # We don't call mt5_manager.is_connected(str(user.id)) here anymore
            # as the backend no longer maintains the connection.
            pass
            TF_MAP = {
                "M1": mt5.TIMEFRAME_M1, "M5": mt5.TIMEFRAME_M5, "M15": mt5.TIMEFRAME_M15,
                "M30": mt5.TIMEFRAME_M30, "H1": mt5.TIMEFRAME_H1, "H4": mt5.TIMEFRAME_H4,
                "D1": mt5.TIMEFRAME_D1, "W1": mt5.TIMEFRAME_W1, "MN1": mt5.TIMEFRAME_MN1,
            }
            tf = TF_MAP.get(item.timeframe.upper())
            if not tf: continue
            try:
                rates = mt5.copy_rates_from_pos(item.symbol, tf, 0, 2)
                if rates is not None and len(rates) > 0:
                    results.append({
                        "symbol": item.symbol, "timeframe": item.timeframe.upper(),
                        "candles": [{"time": int(r["time"]), "open": float(r["open"]), "high": float(r["high"]),
                                      "low": float(r["low"]), "close": float(r["close"]), "tick_volume": int(r["tick_volume"])}
                                    for r in rates],
                    })
            except Exception as e:
                print(f"Candle error for {item.symbol}: {e}")
                
    return {"data": results}


# ── WebSocket (per-user) ──────────────────────────────────────────────────────
@app.websocket("/ws/mt5")
async def ws_mt5(ws: WebSocket):
    token = ws.query_params.get("token")
    if not token:
        await ws.close(code=4001)
        return
    payload = decode_token(token)
    if not payload:
        await ws.close(code=4001)
        return
    user_id = payload.get("sub")
    if not user_id:
        await ws.close(code=4001)
        return

    await ws.accept()
    
    # Send initial price/candle cache immediately so UI doesn't stay on "Connecting..."
    try:
        await ws.send_text(json.dumps({
            "type": "prices",
            "prices": _price_cache,
            "candles": _candle_cache
        }))
    except Exception as e:
        print(f"DEBUG WS: Failed to send initial cache: {e}")
    if user_id not in _ws_clients:
        _ws_clients[user_id] = []
    _ws_clients[user_id].append(ws)

    try:
        while True:
            await ws.receive_text()  # keep-alive ping
    except WebSocketDisconnect:
        if user_id in _ws_clients and ws in _ws_clients[user_id]:
            _ws_clients[user_id].remove(ws)


# ── Bridge WebSocket (Price/Candle Pushes) ───────────────────────────────────
@app.websocket("/ws/bridge/prices")
async def ws_bridge_prices(ws: WebSocket):
    """
    WebSocket for the MT5 Bridge (Windows) to push real-time prices & candles.
    Uses the BRIDGE_KEY for authentication.
    """
    token = ws.query_params.get("token")
    if token != BRIDGE_KEY:
        print(f"DEBUG BRIDGE WS: Rejected connection from {ws.client}. Invalid token: {token}")
        await ws.close(code=4003)
        return
        
    await ws.accept()
    print(f"✅ DEBUG BRIDGE WS: Connected to MT5 Bridge at {ws.client}")
    
    try:
        while True:
            data = await ws.receive_json()
            if "prices" in data:
                _price_cache.update(data["prices"])
            if "candles" in data:
                _candle_cache.update(data["candles"])
            
            # Broadcast to all users
            asyncio.create_task(broadcast_to_all({
                "type": "prices",
                "prices": data.get("prices", {}),
                "candles": data.get("candles", {})
            }))
    except WebSocketDisconnect:
        print(f"DEBUG BRIDGE WS: MT5 Bridge disconnected: {ws.client}")
    except Exception as e:
        print(f"DEBUG BRIDGE WS: Error: {e}")


# ── Journal Endpoints ─────────────────────────────────────────────────────────
@app.get("/api/journal")
async def get_journal(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    notes_result = await db.execute(select(JournalNote).where(JournalNote.user_id == user.id))
    notes = {n.day: n.text for n in notes_result.scalars().all()}

    tags_result = await db.execute(select(JournalTag).where(JournalTag.user_id == user.id))
    tags = [t.name for t in tags_result.scalars().all()]

    dtags_result = await db.execute(select(DailyTag).where(DailyTag.user_id == user.id))
    daily_tags: Dict[str, List[str]] = {}
    for dt in dtags_result.scalars().all():
        daily_tags.setdefault(dt.day, []).append(dt.tag)

    return {"notes": notes, "tags": tags, "dailyTags": daily_tags}


class NoteRequest(BaseModel):
    day: str  # "YYYY-MM-DD"
    text: str

@app.post("/api/journal/note")
async def save_note(req: NoteRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(JournalNote).where(JournalNote.user_id == user.id, JournalNote.day == req.day)
    )
    note = result.scalar_one_or_none()
    if note:
        note.text = req.text
        note.updated_at = datetime.datetime.utcnow()
    else:
        db.add(JournalNote(user_id=user.id, day=req.day, text=req.text))
    await db.commit()
    return {"ok": True}


class TagToggleRequest(BaseModel):
    day: str
    tag: str

@app.post("/api/journal/daily-tag/toggle")
async def toggle_daily_tag(req: TagToggleRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DailyTag).where(DailyTag.user_id == user.id, DailyTag.day == req.day, DailyTag.tag == req.tag)
    )
    dt = result.scalar_one_or_none()
    if dt:
        await db.delete(dt)
    else:
        db.add(DailyTag(user_id=user.id, day=req.day, tag=req.tag))
    await db.commit()
    return {"ok": True}


class AddTagRequest(BaseModel):
    name: str

@app.post("/api/journal/tag")
async def add_tag(req: AddTagRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(JournalTag).where(JournalTag.user_id == user.id, JournalTag.name == req.name)
    )
    if not result.scalar_one_or_none():
        db.add(JournalTag(user_id=user.id, name=req.name))
        await db.commit()
    return {"ok": True}


class DeleteTagRequest(BaseModel):
    name: str

@app.delete("/api/journal/tag")
async def delete_tag(req: DeleteTagRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await db.execute(
        delete(JournalTag).where(JournalTag.user_id == user.id, JournalTag.name == req.name)
    )
    await db.commit()
    return {"ok": True}


# ── Alerts Endpoints ──────────────────────────────────────────────────────────
@app.get("/api/alerts")
async def get_alerts(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Alert).where(Alert.user_id == user.id))
    alerts = [a.data for a in result.scalars().all()]
    return {"alerts": alerts}


class AlertRequest(BaseModel):
    data: dict

@app.post("/api/alerts")
async def create_alert(req: AlertRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    alert_id = str(uuid.uuid4())[:7]
    alert_data = {**req.data, "id": alert_id}
    db.add(Alert(id=alert_id, user_id=user.id, data=alert_data))
    await db.commit()
    return {"ok": True, "id": alert_id, "alert": alert_data}


class AlertUpdateRequest(BaseModel):
    partial: dict

@app.put("/api/alerts/{alert_id}")
async def update_alert(alert_id: str, req: AlertUpdateRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Alert).where(Alert.id == alert_id, Alert.user_id == user.id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.data = {**alert.data, **req.partial}
    await db.commit()
    return {"ok": True, "alert": alert.data}


@app.delete("/api/alerts/{alert_id}")
async def delete_alert(alert_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(Alert).where(Alert.id == alert_id, Alert.user_id == user.id))
    await db.commit()
    return {"ok": True}


@app.get("/api/alerts/history")
async def get_alert_history(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AlertHistory)
        .where(AlertHistory.user_id == user.id)
        .order_by(AlertHistory.triggered_at.desc())
        .limit(100)
    )
    history = []
    for h in result.scalars().all():
        history.append({
            "id": h.id,
            "data": h.data,
            "triggeredAt": h.triggered_at.isoformat()
        })
    return {"history": history}


@app.delete("/api/alerts/history")
async def clear_alert_history(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(AlertHistory).where(AlertHistory.user_id == user.id))
    await db.commit()
    return {"ok": True}


class TestPushRequest(BaseModel):
    alertId: Optional[str] = None

@app.post("/api/alerts/test-push")
async def test_push(req: TestPushRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Called by web UI 'Test' button — sends a test push notification to the user's mobile device."""
    s = await db.get(UserSettings, user.id)
    print(f"DEBUG test-push: user={user.id}, has_settings={s is not None}, push_token={s.expo_push_token[:30] if s and s.expo_push_token else None}")
    if not s or not s.expo_push_token:
        return {"ok": False, "reason": "No push token registered"}
    
    title = "🔔 Alert Test"
    body = "This is a test push notification from TimeJournal."
    
    # If alertId provided, use alert details
    if req.alertId:
        result = await db.execute(select(Alert).where(Alert.id == req.alertId, Alert.user_id == user.id))
        alert = result.scalar_one_or_none()
        print(f"DEBUG test-push: alertId={req.alertId}, found_in_db={alert is not None}")
        if alert:
            a = alert.data
            if a.get("type") == "candle":
                title = f"🚨 {a.get('symbol')} {a.get('timeframe')} Momentum! (Test)"
                body = f"Simulated candle alert: ≥{a.get('minBodyPips')} pips, ≤{a.get('maxWickPercent')}% wick"
            else:
                title = f"🎯 {a.get('symbol')} Price Target! (Test)"
                body = f"{a.get('symbol')} crossed {a.get('trigger')} {a.get('targetPrice')}"
            sound = a.get("soundUri") or a.get("sound", "default")
        else:
            sound = "default"
    else:
        sound = "default"
    
    print(f"DEBUG test-push: sending — title={title}, sound={sound}")
    await send_expo_push_notification(s.expo_push_token, title, body, {"type": "test"}, sound=sound)
    return {"ok": True}


class FirePushRequest(BaseModel):
    alertId: str
    title: str
    body: str

@app.post("/api/alerts/fire-push")
async def fire_push(req: FirePushRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Called by web AlertWatcher when an alert actually fires — sends push notification to mobile."""
    s = await db.get(UserSettings, user.id)
    print(f"DEBUG fire-push: user={user.id}, has_token={bool(s and s.expo_push_token)}")
    if not s or not s.expo_push_token:
        return {"ok": False, "reason": "No push token"}
    
    # Get sound from alert
    result = await db.execute(select(Alert).where(Alert.id == req.alertId, Alert.user_id == user.id))
    alert = result.scalar_one_or_none()
    sound = "default"
    if alert:
        a = alert.data
        sound = a.get("soundUri") or a.get("sound", "default")
        print(f"DEBUG fire-push: alertId={req.alertId}, found_alert=True, sound={sound}")
    else:
        print(f"DEBUG fire-push: alertId={req.alertId}, found_alert=False (no DB entry)")
    
    await send_expo_push_notification(
        s.expo_push_token, req.title, req.body,
        {"alertId": req.alertId, "type": "alert", "soundUrl": sound},
        sound=sound
    )
    return {"ok": True}


# ── Settings Endpoints ────────────────────────────────────────────────────────
# Removed duplicate get_settings definition (already at 678)


class SettingsUpdateRequest(BaseModel):
    theme: Optional[str] = None
    newsSettings: Optional[dict] = None
    terminalLayout: Optional[dict] = None
    expo_push_token: Optional[str] = None

@app.put("/api/settings")
async def update_settings(req: SettingsUpdateRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    s = await db.get(UserSettings, user.id)
    if not s:
        s = UserSettings(user_id=user.id, theme="light", news_settings={})
        db.add(s)
    if req.theme is not None:
        s.theme = req.theme
    if req.newsSettings is not None:
        s.news_settings = req.newsSettings
    if req.terminalLayout is not None:
        s.terminal_layout = req.terminalLayout
    if req.expo_push_token is not None:
        s.expo_push_token = req.expo_push_token
    s.updated_at = datetime.datetime.utcnow()
    await db.commit()
    return {"ok": True}


# ── AI Endpoints ──────────────────────────────────────────────────────────────

class AIChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class AIChatRequest(BaseModel):
    messages: List[AIChatMessage]
    context_type: str = "general"
    guard_context: Optional[dict] = None  # Trading Guard: {enabled, lossLimit, profitGoal, dailyPnL, status}

@app.post("/api/ai/chat")
async def ai_chat(req: AIChatRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not XAI_AVAILABLE:
        raise HTTPException(status_code=500, detail="xAI (Grok) tidak tersedia. Periksa API key.")

    # --- Fetch ALL user trades from DB (no limit) ---
    res_acc = await db.execute(
        select(MT5Account).where(MT5Account.user_id == user.id, MT5Account.is_active == True)
    )
    active_acc = res_acc.scalar_one_or_none()

    account_context = ""
    stats_context = ""

    if active_acc:
        acc_info = active_acc.account_info or {}
        balance = acc_info.get("balance", 0)
        equity = acc_info.get("equity", 0)
        deposit = acc_info.get("deposit", 0)
        account_context = f"Balance: ${balance:.2f}, Equity: ${equity:.2f}, Deposit: ${deposit:.2f}"

        # Fetch ALL trades for the ACTIVE account (same filter as dashboard)
        res_trades = await db.execute(
            select(Trade).where(
                Trade.user_id == user.id,
                Trade.account_id == active_acc.id  # KEY: filter by active account only
            ).order_by(Trade.synced_at.desc())
        )
        all_trades = res_trades.scalars().all()

        if all_trades:
            trade_list = [t.data for t in all_trades if t.data]
            total = len(trade_list)
            wins = sum(1 for t in trade_list if (t.get("profit", 0) or 0) > 0)
            losses = total - wins
            total_pnl = sum((t.get("profit", 0) or 0) + (t.get("swap", 0) or 0) + (t.get("commission", 0) or 0) for t in trade_list)
            win_rate = (wins / total * 100) if total > 0 else 0

            # Symbol breakdown (all symbols)
            symbols: dict = {}
            for t in trade_list:
                sym = t.get("symbol", "N/A")
                pnl = (t.get("profit", 0) or 0) + (t.get("swap", 0) or 0) + (t.get("commission", 0) or 0)
                if sym not in symbols:
                    symbols[sym] = {"count": 0, "pnl": 0.0, "wins": 0}
                symbols[sym]["count"] += 1
                symbols[sym]["pnl"] += pnl
                if pnl > 0:
                    symbols[sym]["wins"] += 1
            sym_summary = ", ".join([
                f"{s}: {v['count']} trades, WR={int(v['wins']/v['count']*100)}%, PnL=${v['pnl']:.2f}"
                for s, v in sorted(symbols.items(), key=lambda x: -x[1]["count"])
            ])

            # Daily performance index (for date-specific queries)
            daily: dict = {}
            for t in trade_list:
                ts = t.get("closeTime") or t.get("openTime") or t.get("time") or ""
                if ts:
                    try:
                        dt_str = ts.replace(" ", "T")
                        day = dt_str[:10]  # YYYY-MM-DD
                        hour = dt_str[11:16] if len(dt_str) > 10 else ""
                        pnl = (t.get("profit", 0) or 0) + (t.get("swap", 0) or 0) + (t.get("commission", 0) or 0)
                        if day not in daily:
                            daily[day] = {"trades": [], "pnl": 0.0}
                        daily[day]["pnl"] += pnl
                        daily[day]["trades"].append(
                            f"{hour} {t.get('symbol','?')} {t.get('type','?')} {t.get('lots', t.get('volume',0))} lots | PnL:${pnl:.2f} | Setup:{t.get('setup','N/A')} | Session:{t.get('session','N/A')}"
                        )
                    except: pass

            # Format daily data — last 30 days with detail, summary for older
            sorted_days = sorted(daily.keys(), reverse=True)
            recent_days = sorted_days[:30]
            older_days = sorted_days[30:]

            daily_detail_lines = []
            for day in recent_days:
                d = daily[day]
                daily_detail_lines.append(f"\n[{day}] Total PnL: ${d['pnl']:.2f} ({len(d['trades'])} trades)")
                for tl in d["trades"]:
                    daily_detail_lines.append(f"  · {tl}")

            older_summary = ""
            if older_days:
                older_pnl = sum(daily[d]["pnl"] for d in older_days)
                older_count = sum(len(daily[d]["trades"]) for d in older_days)
                older_summary = f"\n\n[Periode lebih lama: {older_days[-1]} s/d {older_days[0]}] Total: {older_count} trades, PnL: ${older_pnl:.2f}"

            # Session breakdown
            sessions: dict = {}
            for t in trade_list:
                sess = t.get("session", "Unknown")
                pnl = (t.get("profit", 0) or 0) + (t.get("swap", 0) or 0) + (t.get("commission", 0) or 0)
                if sess not in sessions:
                    sessions[sess] = {"count": 0, "pnl": 0.0}
                sessions[sess]["count"] += 1
                sessions[sess]["pnl"] += pnl
            session_summary = ", ".join([f"{s}: {v['count']} trades (${v['pnl']:.2f})" for s, v in sessions.items()])

            # Profit factor
            total_win_p = sum((t.get("profit", 0) or 0) for t in trade_list if (t.get("profit", 0) or 0) > 0)
            total_loss_p = abs(sum((t.get("profit", 0) or 0) for t in trade_list if (t.get("profit", 0) or 0) < 0))
            profit_factor = total_win_p / total_loss_p if total_loss_p > 0 else total_win_p

            # Average win/loss
            win_trades = [abs((t.get("profit", 0) or 0)) for t in trade_list if (t.get("profit", 0) or 0) > 0]
            loss_trades = [abs((t.get("profit", 0) or 0)) for t in trade_list if (t.get("profit", 0) or 0) < 0]
            avg_win = sum(win_trades) / len(win_trades) if win_trades else 0
            avg_loss = sum(loss_trades) / len(loss_trades) if loss_trades else 0

            stats_context = f"""
=== RINGKASAN STATISTIK (SEMUA DATA: {total} TRADES) ===
Win Rate: {win_rate:.1f}% | Wins: {wins} | Losses: {losses}
Total PnL: ${total_pnl:.2f} | Avg Win: ${avg_win:.2f} | Avg Loss: ${avg_loss:.2f}
Profit Factor: {profit_factor:.2f}
Symbols: {sym_summary}
Sessions: {session_summary}

=== CATATAN HARIAN (30 HARI TERAKHIR) ===
{''.join(daily_detail_lines)}{older_summary}"""

    # -- Current date/time context in WIB --
    now_wib = datetime.datetime.now(WIB)
    current_datetime_str = now_wib.strftime("%A, %d %B %Y %H:%M WIB")
    yesterday_str = (now_wib - datetime.timedelta(days=1)).strftime("%A, %d %B %Y")
    last_saturday = now_wib - datetime.timedelta(days=(now_wib.weekday() - 5) % 7 or 7)
    last_saturday_str = last_saturday.strftime("%A, %d %B %Y")

    # --- System Prompt ---
    system_prompt = f"""Kamu adalah AI Trading Coach profesional untuk aplikasi TimeJournal.
Nama kamu: "Grok Coach". Gunakan Bahasa Indonesia yang santai tapi profesional.
Istilah teknikal boleh tetap Bahasa Inggris. Jawab RINGKAS & tepat sasaran kecuali diminta detail.

WAKTU SAAT INI: {current_datetime_str}
Kemarin = {yesterday_str}
Sabtu lalu = {last_saturday_str}
(Gunakan konteks waktu ini untuk menjawab pertanyaan seperti "kemarin", "minggu lalu", "sabtu kemarin", dll.)

DATA AKUN USER — {user.name}:
{f"Account: {account_context}" if account_context else "Account: Belum tersambung MT5"}
{stats_context if stats_context else "Catatan: Belum ada data trade."}

KEMAMPUAN KAMU:
- Jawab pertanyaan tentang trade di TANGGAL dan JAM SPESIFIK menggunakan data harian di atas
- Hitung statistik spesifik (win rate per simbol, per sesi, per periode)
- Berikan proyeksi ekuitas berdasarkan statistik saat ini
- Evaluasi psikologi & pola trading
- Jelaskan konsep trading (strategi, risk management, dll)
- Bandingkan performa antar periode

ATURAN KETAT:
1. JANGAN buat data fiktif. Kalau data tidak ada, bilang jujur.
2. Kalau user tanya trade tanggal spesifik, cari di catatan harian di atas.
3. Data user ini RAHASIA - jangan expose ke siapapun selain user ini.
{f'''
STATUS TRADING GUARD HARI INI:
- Fitur: {"AKTIF" if req.guard_context.get("enabled") else "NONAKTIF"}
- Daily PnL: ${req.guard_context.get("dailyPnL", 0):.2f}
- Max Loss Limit: ${req.guard_context.get("lossLimit", 0):.2f}
- Profit Goal: ${req.guard_context.get("profitGoal", 0):.2f}
- Status: {req.guard_context.get("status", "normal").upper()}
{("⚠️ USER SUDAH MENCAPAI MAX DAILY LOSS. Berikan respons yang supportif, ingatkan untuk berhenti trading hari ini, dan evaluasi psikologi." if req.guard_context.get("status") == "loss_limit" else "")}
{("✅ USER SUDAH MENCAPAI DAILY PROFIT GOAL. Berikan apresiasi, sarankan untuk mengamankan profit dan istirahat." if req.guard_context.get("status") == "profit_goal" else "")}''' if req.guard_context and req.guard_context.get("enabled") else ""}"""

    grok_messages = [{"role": "system", "content": system_prompt}]
    for msg in req.messages:
        grok_messages.append({"role": msg.role, "content": msg.content})

    try:
        response = ai_client.chat.completions.create(
            model="grok-3-fast",
            messages=grok_messages,
            temperature=0.7,
            max_tokens=1500
        )
        reply = response.choices[0].message.content
        return {"success": True, "reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class AutoTagRequest(BaseModel):
    ticket: str
    symbol: str
    trade_type: str  # "BUY" or "SELL"
    pnl: float
    lots: float
    open_time: str
    close_time: str
    session: str = ""
    setup: str = ""
    emotion: str = ""
    notes: str = ""

@app.post("/api/ai/auto-tag")
async def ai_auto_tag(req: AutoTagRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Auto-tag a trade with AI-suggested setup, emotion classification, and notes."""
    if not XAI_AVAILABLE:
        raise HTTPException(status_code=500, detail="xAI tidak tersedia.")

    prompt = f"""Analisa trade ini dan berikan klasifikasi singkat:
Trade: {req.trade_type} {req.symbol} {req.lots} lots
PnL: ${req.pnl:.2f} | Session: {req.session}
Open: {req.open_time} | Close: {req.close_time}
Setup saat ini: {req.setup or 'N/A'} | Emosi: {req.emotion or 'N/A'}

Respond dengan JSON (HANYA JSON, tanpa teks lain):
{{
  "suggested_setup": "nama setup teknikal yang paling mungkin (max 3 kata)",
  "suggested_emotion": "satu emosi yang paling mungkin: Confident/Anxious/Neutral/Revengeful/Greedy/Fearful",
  "quality": "A+/A/B/C berdasarkan R:R dan konsistensi",
  "note": "1 kalimat evaluasi singkat"
}}"""

    try:
        response = ai_client.chat.completions.create(
            model="grok-3-fast",
            messages=[
                {"role": "system", "content": "You are a trading classifier. Respond ONLY with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=200
        )
        raw = response.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        import json as json_lib
        result = json_lib.loads(raw)
        return {"success": True, "suggestion": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class EquityProjectionRequest(BaseModel):
    months: int = 6

@app.post("/api/ai/equity-projection")
async def equity_projection(req: EquityProjectionRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Calculate equity projection based on current trading statistics."""
    if not XAI_AVAILABLE:
        raise HTTPException(status_code=500, detail="xAI tidak tersedia.")

    res_acc = await db.execute(
        select(MT5Account).where(MT5Account.user_id == user.id, MT5Account.is_active == True)
    )
    active_acc = res_acc.scalar_one_or_none()

    if not active_acc:
        return {"success": False, "message": "Akun MT5 belum tersambung."}

    acc_info = active_acc.account_info or {}
    balance = acc_info.get("balance", 0)

    res_trades = await db.execute(
        select(Trade).where(Trade.user_id == user.id).order_by(Trade.synced_at.desc())
    )
    all_trades = res_trades.scalars().all()
    trade_list = [t.data for t in all_trades if t.data]

    if not trade_list or balance == 0:
        return {"success": False, "message": "Data tidak cukup untuk proyeksi."}

    total = len(trade_list)
    total_pnl = sum((t.get("profit", 0) or 0) + (t.get("swap", 0) or 0) + (t.get("commission", 0) or 0) for t in trade_list)
    wins = sum(1 for t in trade_list if (t.get("profit", 0) or 0) > 0)
    win_rate = wins / total * 100 if total > 0 else 0

    # Estimate trades per month from date range
    dates = []
    for t in trade_list:
        ts = t.get("closeTime") or t.get("openTime") or ""
        if ts:
            try:
                dates.append(ts[:10])
            except: pass

    trades_per_month = total / max(1, len(set(d[:7] for d in dates)))
    avg_pnl_per_trade = total_pnl / total if total > 0 else 0

    prompt = f"""Buat proyeksi ekuitas trading realistis berdasarkan data ini:
Balance saat ini: ${balance:.2f}
Total trade: {total} | Win Rate: {win_rate:.1f}%
Total PnL keseluruhan: ${total_pnl:.2f} | Rata-rata PnL/trade: ${avg_pnl_per_trade:.2f}
Estimasi trade/bulan: {trades_per_month:.0f}
Periode proyeksi: {req.months} bulan

Format response singkat dalam Bahasa Indonesia:
1. Proyeksi ekuitas per bulan (bulan 1 s/d {req.months})
2. Kondisi paling optimis dan paling pesimis  
3. Satu saran untuk meningkatkan performa
Gunakan angka konkret, TANPA teks pembuka/penutup."""

    try:
        response = ai_client.chat.completions.create(
            model="grok-3-fast",
            messages=[
                {"role": "system", "content": "You are a professional trading performance analyst responding in Indonesian."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
            max_tokens=600
        )
        projection = response.choices[0].message.content
        return {"success": True, "projection": projection, "current_balance": balance, "months": req.months}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))





class AIAnalyzeRequest(BaseModel):
    totalTrades: int
    winRate: float
    totalPnl: float
    bestSymbol: str
    worstSymbol: str
    recentStreaks: str = ""
    notes: str = ""

@app.post("/api/ai/analyze")
async def analyze_ai(req: AIAnalyzeRequest, user: User = Depends(get_current_user)):
    if not XAI_AVAILABLE:
        raise HTTPException(status_code=500, detail="xAI (Grok) tidak tersedia. Periksa API key.")
    prompt = f"""Bertindaklah sebagai Ahli Psikologi Trading dan Manajer Risiko. Analisis data trading berikut.
ATURAN WAJIB:
1. DILARANG menggunakan awalan sapaan.
2. DILARANG menggunakan emoji.
3. DILARANG menggunakan kata penutup.
4. Gunakan bahasa Indonesia profesional. Istilah teknis tetap bahasa Inggris dengan terjemahan singkat di dalam kurung.

Statistik Pengguna:
- Total Trades: {req.totalTrades}
- Win Rate: {req.winRate:.1f}%
- Total Net PnL: ${req.totalPnl:.2f}
- Best Symbol: {req.bestSymbol}
- Worst Symbol: {req.worstSymbol}
- Streaks: {req.recentStreaks}
- Catatan: {req.notes}

Format Markdown rapi. Bold setiap awal paragraf/poin utama.
Struktur:
**Kesimpulan (Performance Verdict):** [1-2 kalimat]
**Kekuatan & Kelemahan:** [poin-poin]
**Saran & Evaluasi (Actionable Advice):** [Teknikal & Psikologis]
**Quote Psikologi Trading:** [kutipan + makna]"""
    try:
        response = ai_client.chat.completions.create(
            model="grok-4-1-fast-reasoning",
            messages=[
                {"role": "system", "content": "You are a professional Trading Psychologist responding in Indonesian."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7, max_tokens=1000
        )
        return {"success": True, "insight": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class NewsAnalysisRequest(BaseModel):
    target_events: list[dict]
    context_events: list[dict]

@app.post("/api/ai/analyze-news")
async def analyze_news_ai(req: NewsAnalysisRequest, user: User = Depends(get_current_user)):
    if not XAI_AVAILABLE:
        raise HTTPException(status_code=500, detail="xAI tidak tersedia.")
    if not req.target_events:
        return {"success": True, "insight": "Tidak ada berita relevan yang dipilih berdasarkan filter Anda hari ini."}
    target_text = "\n".join([
        f"- {e.get('date','')} ({e.get('country','')} {e.get('impact','')}): {e.get('title','')}. Forecast: {e.get('forecast','-')}, Previous: {e.get('previous','-')}"
        for e in req.target_events
    ])
    context_text = "\n".join([
        f"- {e.get('date','')} ({e.get('country','')} {e.get('impact','')}): {e.get('title','')}. Forecast: {e.get('forecast','-')}, Previous: {e.get('previous','-')}"
        for e in req.context_events
    ])
    prompt = f"""Bertindaklah sebagai Ahli Makroekonomi dan Analis Fundamental Trading (Gold/XAUUSD).
ATURAN: Tanpa sapaan, tanpa emoji, tanpa basa-basi. Bahasa Indonesia profesional.

**Konteks Makro Seminggu:**
{context_text}

**TARGET HARI INI:**
{target_text}

Format Markdown. Bold setiap poin utama. Struktur:
**Ringkasan Sentimen Makro:** [1-2 kalimat]
**Sorotan & Korelasi Data:** [poin-poin]
**Rekomendasi Eksekusi XAUUSD (Gold):**
- **Sinyal Inti:** [BUY atau SELL]
- **Alasan Utama:** [1-2 kalimat]
- **Peringatan Volatilitas:** [1 kalimat]"""
    try:
        response = ai_client.chat.completions.create(
            model="grok-4-1-fast-reasoning",
            messages=[
                {"role": "system", "content": "You are a professional Fundamental Analyst responding in Indonesian."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7, max_tokens=900
        )
        return {"success": True, "insight": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/news")
async def get_news():
    """Returns the cached economic news calendar."""
    return _news_cache


@app.get("/api/auth/news-settings")
async def get_news_settings(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
    settings = result.scalar_one_or_none()
    if not settings:
        return {"enabled": False, "minutesBefore": 5, "sound": "default", "selectedEvents": [], "autoHighImpact": False}
    return settings.news_settings


@app.put("/api/auth/news-settings")
async def update_news_settings(new_settings: dict, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = UserSettings(user_id=user.id)
        db.add(settings)
    
    # Merge existing or set new
    current = settings.news_settings or {}
    current.update(new_settings)
    settings.news_settings = current
    flag_modified(settings, "news_settings")
    await db.commit()
    return current


@app.put("/api/auth/audio-settings")
async def update_audio_settings(new_settings: dict, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = UserSettings(user_id=user.id)
        db.add(settings)
    
    # Merge existing or set new
    current = settings.audio_settings or {}
    current.update(new_settings)
    settings.audio_settings = current
    flag_modified(settings, "audio_settings")
    await db.commit()
    return current


# ── Alert Evaluator Background Loop ──────────────────────────────────────────
async def _alert_evaluator_loop():
    """Runs every 5 seconds. Evaluates alerts against cached prices and sends push notifications."""
    COOLDOWN_SECONDS = 60  # Don't re-notify same alert within 60s
    await asyncio.sleep(10)  # Wait for DB init
    print("🔔 Alert evaluator loop running")
    
    while True:
        try:
            if _price_cache:  # Only evaluate if we have price data
                async with AsyncSessionLocal() as db:
                    # Fetch all users with alerts and push tokens
                    result = await db.execute(
                        select(User).options(
                            selectinload(User.alerts),
                            selectinload(User.settings)
                        )
                    )
                    users = result.scalars().all()
                    
                    now = asyncio.get_event_loop().time()
                    
                    for user in users:
                        if not user.settings or not user.settings.expo_push_token:
                            continue
                        push_token = user.settings.expo_push_token
                        
                        for alert_row in user.alerts:
                            # Check DB-level enabled flag first, then data field
                            if not alert_row.enabled:
                                continue
                            alert = alert_row.data
                            if not alert.get("enabled", True):
                                continue
                            
                            alert_id = alert_row.id
                            
                            # Cooldown check
                            last_notified = _alert_notified.get(alert_id, 0)
                            if now - last_notified < COOLDOWN_SECONDS:
                                continue
                            
                            symbol = alert.get("symbol", "")
                            alert_type = alert.get("type", "")
                            
                            triggered = False
                            title = ""
                            body = ""
                            
                            if alert_type == "price" and symbol in _price_cache:
                                current_price = _price_cache[symbol]
                                target = alert.get("targetPrice", 0)
                                trigger = alert.get("trigger", "")
                                
                                if trigger == "Above" and current_price >= target:
                                    triggered = True
                                    title = f"🎯 {symbol} Price Target!"
                                    body = f"{symbol} reached above {target}! Current: {current_price}"
                                elif trigger == "Below" and current_price <= target:
                                    triggered = True
                                    title = f"🎯 {symbol} Price Target!"
                                    body = f"{symbol} dropped below {target}! Current: {current_price}"
                                elif trigger == "Crosses" and abs(current_price - target) / target < 0.001:
                                    triggered = True
                                    title = f"🎯 {symbol} Price Target!"
                                    body = f"{symbol} crossed target {target}! Current: {current_price}"
                                
                                if alert.get("notes"):
                                    body += f"\nNote: {alert['notes']}"
                            
                            elif alert_type == "candle":
                                tf = alert.get("timeframe", "M1")
                                cache_key = f"{symbol}_{tf}"
                                candles = _candle_cache.get(cache_key, [])
                                
                                if len(candles) >= 2:
                                    c = candles[-1]  # Current candle
                                    close_val = c.get("close", 0)
                                    open_val = c.get("open", 0)
                                    high_val = c.get("high", 0)
                                    low_val = c.get("low", 0)
                                    
                                    body_size = abs(close_val - open_val)
                                    wick = (high_val - low_val) - body_size
                                    wick_pct = (wick / (high_val - low_val) * 100) if (high_val - low_val) > 0 else 100
                                    
                                    # Calculate pips
                                    pip_size = 0.01 if "JPY" in symbol.upper() else 0.0001
                                    if any(x in symbol.upper() for x in ["XAU", "GOLD"]): pip_size = 0.1
                                    body_pips = body_size / pip_size
                                    
                                    min_body = alert.get("minBodyPips", 0)
                                    max_wick = alert.get("maxWickPercent", 100)
                                    
                                    if body_pips >= min_body and wick_pct <= max_wick:
                                        direction = "Bullish" if close_val > open_val else "Bearish"
                                        triggered = True
                                        title = f"🚨 {symbol} {tf} Momentum!"
                                        body = f"{direction} candle with {body_pips:.1f} pips body and {wick_pct:.0f}% wick!"
                            
                            if triggered:
                                _alert_notified[alert_id] = now
                                
                                if push_token:
                                    alert_sound = alert.get("soundUri") or alert.get("sound", "default")
                                    await send_expo_push_notification(
                                        push_token, title, body,
                                        {"alertId": alert_id, "symbol": symbol, "soundUrl": alert_sound},
                                        sound=alert_sound
                                    )
                                
                                # Disable "Once" alerts
                                if alert.get("frequency") == "Once":
                                    alert["enabled"] = False
                                    alert_row.data = alert
                                    flag_modified(alert_row, "data")
                                    await db.commit()

                                # Save to History
                                history_entry = AlertHistory(
                                    id=str(uuid.uuid4()),
                                    user_id=user.id,
                                    alert_id=alert_id,
                                    data={
                                        "title": title,
                                        "body": body,
                                        "symbol": symbol,
                                        "type": alert_type,
                                        "alert_data": alert # snapshot
                                    },
                                    triggered_at=datetime.datetime.utcnow()
                                )
                                db.add(history_entry)
                                
                                # Enforce history limit
                                limit = (user.settings.terminal_layout or {}).get("alertHistoryLimit", 50) if user.settings else 50
                                await db.flush()
                                
                                # Delete old entries if exceeding limit
                                hist_count_res = await db.execute(
                                    select(AlertHistory).where(AlertHistory.user_id == user.id).order_by(AlertHistory.triggered_at.desc())
                                )
                                all_hist = hist_count_res.scalars().all()
                                if len(all_hist) > limit:
                                    to_delete = all_hist[limit:]
                                    for old_h in to_delete:
                                        await db.delete(old_h)
                                
                                await db.commit()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"⚠ Alert evaluator error: {e}")
        
        await asyncio.sleep(5)


# ── News Evaluator Background Loop ───────────────────────────────────────────
async def _update_news_cache():
    """Fetches the latest news JSON every hour."""
    global _news_cache
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get("https://nfs.faireconomy.media/ff_calendar_thisweek.json", headers={"User-Agent": "Mozilla/5.0"})
            if res.status_code == 200:
                _news_cache = res.json()
    except Exception as e:
        print(f"⚠ Failed to fetch news for cache: {e}")

async def _news_evaluator_loop():
    """Runs every 1 minute. Evaluates news events against user settings and pushes notifications."""
    await asyncio.sleep(15)  # Wait for DB init
    print("📰 News evaluator loop running")
    
    last_fetch = 0
    
    while True:
        try:
            now_ts = time.time()
            if now_ts - last_fetch > 3600:  # Refresh every hour
                await _update_news_cache()
                last_fetch = now_ts
                
            if _news_cache:
                async with AsyncSessionLocal() as db:
                    result = await db.execute(
                        select(User).options(selectinload(User.settings))
                    )
                    users = result.scalars().all()
                    
                    now_dt = datetime.datetime.now(datetime.timezone.utc)
                    
                    # Maintenance: clear old notified tracking once a day
                    if len(_news_notified) > 1000:
                        _news_notified.clear()
                    
                    for user in users:
                        if not user.settings or not user.settings.expo_push_token:
                            continue
                        
                        settings = user.settings.news_settings or {}
                        # User must have news alerts enabled globally
                        if not settings.get("enabled", True): 
                            continue
                            
                        push_token = user.settings.expo_push_token
                        selected_events = settings.get("selectedEvents", [])
                        auto_high_impact = settings.get("autoHighImpact", False)
                        minutes_before = settings.get("minutesBefore", 5)
                        news_sound = settings.get("sound", "default")
                        
                        threshold_dt = now_dt + datetime.timedelta(minutes=minutes_before)
                        
                        for ev in _news_cache:
                            impact = ev.get("impact", "")
                            title = ev.get("title", "Berita Ekonomi")
                            ev_date_str = ev.get("date", "")
                            country = ev.get("country", "")
                            
                            if not ev_date_str: continue
                            
                            # Unique key for this specific news event
                            ev_key = f"{title}_{country}_{ev_date_str}"
                            
                            # Check if user wants this alert
                            is_selected = ev_key in selected_events
                            is_auto_high = auto_high_impact and impact == "High"
                            
                            if not (is_selected or is_auto_high):
                                continue
                                
                            try:
                                ev_dt = datetime.datetime.fromisoformat(ev_date_str.replace("Z", "+00:00"))
                                if ev_dt.tzinfo is None:
                                    ev_dt = ev_dt.replace(tzinfo=datetime.timezone.utc)
                            except:
                                continue
                            
                            # If event is within the lead time window
                            # Also check that it hasn't passed yet
                            if now_dt < ev_dt <= threshold_dt:
                                # Track notification per user + event
                                notify_id = f"{user.id}_{ev_key}"
                                
                                if notify_id not in _news_notified:
                                    _news_notified.add(notify_id)
                                    forecast = ev.get("forecast", "-")
                                    prev = ev.get("previous", "-")
                                    
                                    impact_emoji = "🔴" if impact == "High" else ("🟠" if impact == "Medium" else "⚪")
                                    
                                    await send_expo_push_notification(
                                        push_token,
                                        f"{impact_emoji} {country} News Soon",
                                        f"{title} rilis dalam {minutes_before} menit.\nForecast: {forecast} | Prev: {prev}",
                                        {"type": "news", "eventKey": ev_key},
                                        sound=news_sound
                                    )
                                    
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"⚠ News evaluator error: {e}")
            
        await asyncio.sleep(60)  # Check every minute


if __name__ == "__main__":
    import uvicorn
    print("🚀 TimeJournal MT5 Backend v3")
    print(f"📊 MT5: {'Available' if MT5_AVAILABLE else 'Subprocess worker mode'}")
    print("🔌 WebSocket: ws://localhost:8000/ws/mt5?token=<JWT>")
    print("📖 Docs: http://localhost:8000/docs")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
