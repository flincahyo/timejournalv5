"""
backend/database.py
PostgreSQL async database setup with SQLAlchemy.
"""
import os
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, Float, Integer, BigInteger, Text, DateTime, ForeignKey, JSON, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://timejournal:timejournal@localhost:5433/timejournal"
)

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


# ── Models ────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    image: Mapped[str | None] = mapped_column(Text, nullable=True) # Avatar URL or SVG key
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    mt5_accounts: Mapped[list["MT5Account"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    trades: Mapped[list["Trade"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    journal_notes: Mapped[list["JournalNote"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    journal_tags: Mapped[list["JournalTag"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    daily_tags: Mapped[list["DailyTag"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    alert_history: Mapped[list["AlertHistory"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    settings: Mapped["UserSettings | None"] = relationship(back_populates="user", cascade="all, delete-orphan", uselist=False)
    public_shares: Mapped[list["PublicShare"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class MT5Account(Base):
    __tablename__ = "mt5_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    login: Mapped[int] = mapped_column(BigInteger, nullable=False)
    server: Mapped[str] = mapped_column(String(255), nullable=False)
    # password stored encrypted — never plain text
    encrypted_password: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, server_default="true")
    last_sync: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    account_info: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    symbols: Mapped[list] = mapped_column(JSONB, default=list, nullable=False, server_default=text("'[]'"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, server_default=text("now()"))

    user: Mapped["User"] = relationship(back_populates="mt5_accounts")
    trades: Mapped[list["Trade"]] = relationship(back_populates="account", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint('user_id', 'login', 'server', name='_user_account_uc'),)


class Trade(Base):
    __tablename__ = "trades"

    ticket: Mapped[str] = mapped_column(String(64), primary_key=True) # MT5 ticket number
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("mt5_accounts.id"), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    data: Mapped[dict] = mapped_column(JSONB, nullable=False) # full trade JSON blob
    synced_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="trades")
    account: Mapped["MT5Account"] = relationship(back_populates="trades")


class JournalNote(Base):
    __tablename__ = "journal_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    day: Mapped[str] = mapped_column(String(10), nullable=False)  # "YYYY-MM-DD"
    text: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="journal_notes")


class JournalTag(Base):
    __tablename__ = "journal_tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    user: Mapped["User"] = relationship(back_populates="journal_tags")


class DailyTag(Base):
    __tablename__ = "daily_tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    day: Mapped[str] = mapped_column(String(10), nullable=False)
    tag: Mapped[str] = mapped_column(String(100), nullable=False)

    user: Mapped["User"] = relationship(back_populates="daily_tags")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    data: Mapped[dict] = mapped_column(JSONB, nullable=False)  # full alert JSON blob
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="alerts")


class AlertHistory(Base):
    __tablename__ = "alert_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    alert_id: Mapped[str | None] = mapped_column(String(36), nullable=True) # Optional link
    data: Mapped[dict] = mapped_column(JSONB, nullable=False) # Snapshot of alert
    triggered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="alert_history")


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), primary_key=True)
    theme: Mapped[str] = mapped_column(String(20), default="light", nullable=False, server_default=text("'light'"))
    news_settings: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False, server_default=text("'{}'"))
    terminal_layout: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    recap_settings: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False, server_default=text("'{}'"))
    audio_settings: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False, server_default=text("'{}'"))
    expo_push_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False, server_default=text("now()"))

    user: Mapped["User"] = relationship(back_populates="settings")
    
    def to_dict(self):
        return {
            "theme": self.theme,
            "newsSettings": self.news_settings,
            "terminalLayout": self.terminal_layout,
            "recapSettings": self.recap_settings,
            "audioSettings": self.audio_settings,
            "expoPushToken": self.expo_push_token,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None
        }


class PublicShare(Base):
    __tablename__ = "public_shares"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    account_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("mt5_accounts.id"), nullable=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False) # 'dashboard', 'calendar'
    settings: Mapped[dict] = mapped_column(JSONB, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="public_shares")


# ── DB Session Dependency ──────────────────────────────────────────────────────
from contextlib import asynccontextmanager
from typing import AsyncGenerator

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db():
    """Create all tables on startup."""
    from sqlalchemy import text
    
    # 1. Create tables first
    print("Creating tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Base tables checked/created.")

    # 2. Run migrations individually
    print("Running migration steps...")
    migration_stmts = [
        "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS expo_push_token VARCHAR(255);",
        "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT;",
        "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS terminal_layout JSONB;",
        "ALTER TABLE trades ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES mt5_accounts(id);",
        "ALTER TABLE user_settings ALTER COLUMN theme SET DEFAULT 'light';",
        "ALTER TABLE user_settings ALTER COLUMN theme SET NOT NULL;",
        "ALTER TABLE user_settings ALTER COLUMN news_settings SET DEFAULT '{}';",
        "ALTER TABLE user_settings ALTER COLUMN news_settings SET NOT NULL;",
        "ALTER TABLE user_settings ALTER COLUMN updated_at SET DEFAULT now();",
        "ALTER TABLE user_settings ALTER COLUMN updated_at SET NOT NULL;",
        "ALTER TABLE user_settings ALTER COLUMN news_settings TYPE JSONB USING news_settings::jsonb;",
        "ALTER TABLE mt5_accounts ALTER COLUMN account_info TYPE JSONB USING account_info::jsonb;",
        "ALTER TABLE trades ALTER COLUMN data TYPE JSONB USING data::jsonb;",
        "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS recap_settings JSONB NOT NULL DEFAULT '{}';",
        "ALTER TABLE alerts ALTER COLUMN data TYPE JSONB USING data::jsonb;",
        "ALTER TABLE alert_history ALTER COLUMN data TYPE JSONB USING data::jsonb;",
        "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS audio_settings JSONB NOT NULL DEFAULT '{}';",
        "ALTER TABLE mt5_accounts ADD COLUMN IF NOT EXISTS symbols JSONB NOT NULL DEFAULT '[]';",
    ]

    for stmt in migration_stmts:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(stmt))
            except Exception as e:
                # Silently skip if column already exists or other common non-critical errors
                if "already exists" not in str(e).lower() and "does not exist" not in str(e).lower():
                    print(f"Migration detail: {stmt} -> {e}")
    print("✅ Migration steps completed.")
