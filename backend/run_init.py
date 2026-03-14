import asyncio
import os
from database import init_db

async def main():
    print("Starting database initialization on remote server...")
    try:
        await init_db()
        print("✅ Database initialization complete!")
    except Exception as e:
        print(f"❌ Error during initialization: {e}")

if __name__ == "__main__":
    asyncio.run(main())
