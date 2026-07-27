#!/bin/sh
set -e

# ============================================
# GameArt AI Backend - Docker Entrypoint
# Wait for PostgreSQL, then start uvicorn
# ============================================

echo "Waiting for PostgreSQL at ${DB_HOST:-postgres}:${DB_PORT:-5432}..."

python -c "
import socket
import time
import os

host = os.environ.get('DB_HOST', 'postgres')
port = int(os.environ.get('DB_PORT', '5432'))

for i in range(30):
    try:
        s = socket.create_connection((host, port), timeout=2)
        s.close()
        print(f'PostgreSQL is ready (attempt {i + 1})')
        break
    except (socket.error, OSError):
        print(f'Waiting for PostgreSQL ({i + 1}/30)...')
        time.sleep(2)
else:
    print('ERROR: Could not connect to PostgreSQL after 30 attempts')
    exit(1)
"

echo "Starting GameArt AI Backend..."
exec uv run uvicorn main:app --host 0.0.0.0 --port ${BACKEND_PORT:-8000}
