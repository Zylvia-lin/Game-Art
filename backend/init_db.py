"""
Database initialization script.
Creates the database if it doesn't exist.
Run once before starting the backend:
    uv run python init_db.py
"""
import asyncio
import asyncpg
from config import settings


async def init_database():
    """Connect to default 'postgres' db and create our database."""
    print(f"Connecting to PostgreSQL at {settings.DB_HOST}:{settings.DB_PORT}...")
    print(f"Using user: {settings.DB_USER}")
    
    # Connect to default postgres database with configured credentials
    conn = await asyncpg.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        database="postgres",  # Connect to default db first
    )
    
    try:
        # Check if database exists
        db_exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            settings.DB_NAME
        )
        
        if not db_exists:
            await conn.execute(f'CREATE DATABASE {settings.DB_NAME}')
            print(f"✓ Database '{settings.DB_NAME}' created")
        else:
            print(f"✓ Database '{settings.DB_NAME}' already exists")
        
        return True
        
    finally:
        await conn.close()


async def main():
    print("=" * 50)
    print("GameArt AI - Database Initialization")
    print("=" * 50)
    
    try:
        success = await init_database()
        if success:
            print("\n✓ Database ready! Starting backend will auto-create tables.")
            print("  uv run python main.py --reload")
    except asyncpg.exceptions.InvalidPasswordError:
        print(f"\n✗ Authentication failed for user '{settings.DB_USER}'")
        print("  Check DB_PASSWORD in .env")
    except asyncpg.exceptions.ConnectionRefusedError:
        print("\n✗ Cannot connect to PostgreSQL")
        print(f"  Check that PostgreSQL is running at {settings.DB_HOST}:{settings.DB_PORT}")
    except Exception as e:
        print(f"\n✗ Error: {e}")


if __name__ == "__main__":
    asyncio.run(main())
