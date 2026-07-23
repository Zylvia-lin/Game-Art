"""
Database initialization script.
Creates the database and user if they don't exist.
Run once before starting the backend:
    uv run python init_db.py
"""
import asyncio
import asyncpg
from config import settings


async def init_database():
    """Connect to default 'postgres' db and create our database + user."""
    print(f"Connecting to PostgreSQL at {settings.DB_HOST}:{settings.DB_PORT}...")
    
    # Connect to default postgres database
    conn = await asyncpg.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        database="postgres",  # Connect to default db first
    )
    
    try:
        # Check if user exists, create if not
        user_exists = await conn.fetchval(
            "SELECT 1 FROM pg_roles WHERE rolname = $1",
            settings.DB_USER
        )
        if not user_exists:
            # Need superuser to create user - try with postgres superuser
            print(f"User '{settings.DB_USER}' not found. Please create it manually:")
            print(f"  CREATE USER {settings.DB_USER} WITH PASSWORD '{settings.DB_PASSWORD}';")
            return False
        else:
            print(f"User '{settings.DB_USER}' exists")
        
        # Check if database exists
        db_exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            settings.DB_NAME
        )
        if not db_exists:
            await conn.execute(f'CREATE DATABASE {settings.DB_NAME}')
            print(f"Database '{settings.DB_NAME}' created")
        else:
            print(f"Database '{settings.DB_NAME}' already exists")
        
        return True
        
    finally:
        await conn.close()


async def main():
    print("=" * 50)
    print("GameArt AI - Database Initialization")
    print("=" * 50)
    
    # First, try connecting with configured credentials to 'postgres' db
    try:
        success = await init_database()
        if success:
            print("\n✓ Database ready! You can now start the backend:")
            print("  uv run python main.py")
    except asyncpg.exceptions.InvalidPasswordError:
        print(f"\n✗ Authentication failed for user '{settings.DB_USER}'")
        print("\nPlease ensure PostgreSQL is running and create the user:")
        print(f"  CREATE USER {settings.DB_USER} WITH PASSWORD '{settings.DB_PASSWORD}';")
        print(f"  ALTER USER {settings.DB_USER} CREATEDB;")
    except asyncpg.exceptions.ConnectionRefusedError:
        print("\n✗ Cannot connect to PostgreSQL")
        print(f"  Check that PostgreSQL is running at {settings.DB_HOST}:{settings.DB_PORT}")
    except Exception as e:
        print(f"\n✗ Error: {e}")
        print("\nIf you're using Docker PostgreSQL:")
        print("  docker run -d --name gameart-db \\")
        print("    -e POSTGRES_PASSWORD=gameart123 \\")
        print("    -e POSTGRES_USER=gameart \\")
        print("    -e POSTGRES_DB=game_art_ai \\")
        print("    -p 5432:5432 postgres:16")


if __name__ == "__main__":
    asyncio.run(main())
