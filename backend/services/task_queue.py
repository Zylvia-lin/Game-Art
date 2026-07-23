"""
Async task queue service.
Manages generation tasks with background asyncio processing.
"""
import asyncio
import json
from datetime import datetime, timezone
from database import get_pool, fetch_one, fetch_all
from services.generate_service import execute_generation

_processing = False
_process_task: asyncio.Task | None = None


def _to_task(row: dict) -> dict:
    """Convert database row to task dict."""
    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "tool_key": row["tool_key"],
        "input_params": row.get("input_params") or {},
        "status": row["status"],
        "output_urls": row.get("output_urls") or [],
        "error_message": row.get("error_message"),
        "progress": row.get("progress", 0),
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
        "started_at": row["started_at"].isoformat() if row.get("started_at") else None,
        "completed_at": row["completed_at"].isoformat() if row.get("completed_at") else None,
    }


async def create_task(project_id: str, tool_key: str, input_params: dict) -> dict:
    """Create a new task and start processing."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO tasks (project_id, tool_key, input_params, status, progress)
               VALUES ($1, $2, $3::jsonb, 'pending', 0)
               RETURNING *""",
            project_id, tool_key, json.dumps(input_params),
        )
        task = _to_task(dict(row))

    start_processing()
    return task


async def get_task(task_id: str) -> dict | None:
    row = await fetch_one("SELECT * FROM tasks WHERE id = $1", task_id)
    return _to_task(row) if row else None


async def get_project_tasks(project_id: str, status: str | None = None) -> list[dict]:
    if status:
        rows = await fetch_all(
            "SELECT * FROM tasks WHERE project_id = $1 AND status = $2 ORDER BY created_at DESC",
            project_id, status,
        )
    else:
        rows = await fetch_all(
            "SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at DESC",
            project_id,
        )
    return [_to_task(r) for r in rows]


async def get_queue_stats(project_id: str | None = None) -> dict:
    if project_id:
        rows = await fetch_all(
            """SELECT status, COUNT(*) as count FROM tasks
               WHERE project_id = $1 GROUP BY status""",
            project_id,
        )
    else:
        rows = await fetch_all(
            "SELECT status, COUNT(*) as count FROM tasks GROUP BY status"
        )
    stats = {"pending": 0, "processing": 0, "completed": 0, "failed": 0}
    for r in rows:
        stats[r["status"]] = r["count"]
    return stats


async def update_task_status(
    task_id: str,
    status: str,
    output_urls: list | None = None,
    error_message: str | None = None,
    progress: int | None = None,
) -> dict | None:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    started_at = now if status == "processing" else None
    completed_at = now if status in ("completed", "failed") else None

    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """UPDATE tasks SET
                 status = $2,
                 output_urls = COALESCE($3::jsonb, output_urls),
                 error_message = COALESCE($4, error_message),
                 progress = COALESCE($5, progress),
                 started_at = COALESCE(started_at, $6),
                 completed_at = COALESCE($7, completed_at),
                 updated_at = $8
               WHERE id = $1
               RETURNING *""",
            task_id, status,
            json.dumps(output_urls) if output_urls else None,
            error_message, progress,
            started_at, completed_at, now,
        )
        return _to_task(dict(row)) if row else None


async def cancel_task(task_id: str) -> dict | None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """UPDATE tasks SET status = 'failed', error_message = 'Cancelled by user',
                 completed_at = NOW(), updated_at = NOW()
               WHERE id = $1 AND status IN ('pending', 'processing')
               RETURNING *""",
            task_id,
        )
        return _to_task(dict(row)) if row else None


async def _get_next_pending_task() -> dict | None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT * FROM tasks WHERE status = 'pending'
               ORDER BY created_at ASC LIMIT 1
               FOR UPDATE SKIP LOCKED"""
        )
        return _to_task(dict(row)) if row else None


async def _process_single_task(task: dict):
    """Process a single generation task."""
    try:
        await update_task_status(task["id"], "processing", progress=10)

        async def on_progress(pct: int):
            await update_task_status(task["id"], "processing", progress=pct)

        result = await execute_generation(
            task["tool_key"],
            task["input_params"],
            on_progress,
        )

        await update_task_status(
            task["id"], "completed",
            output_urls=result["output_urls"],
            progress=100,
        )

        # Save to generations history
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO generations (project_id, task_id, tool_key, input_params, output_urls, status)
                   VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, 'completed')""",
                task["project_id"], task["id"], task["tool_key"],
                json.dumps(task["input_params"]),
                json.dumps(result["output_urls"]),
            )

    except Exception as e:
        print(f"Task {task['id']} failed: {e}")
        await update_task_status(
            task["id"], "failed",
            error_message=str(e),
        )


async def _process_queue():
    """Background loop that processes pending tasks."""
    global _processing
    while True:
        try:
            if not _processing:
                _processing = True
                task = await _get_next_pending_task()
                if task:
                    await _process_single_task(task)
                _processing = False
            await asyncio.sleep(2)
        except Exception as e:
            _processing = False
            print(f"Queue processing error: {e}")
            await asyncio.sleep(5)


def start_processing():
    """Start the background task processing loop."""
    global _process_task
    if _process_task is None or _process_task.done():
        _process_task = asyncio.create_task(_process_queue())


def stop_processing():
    """Stop the background task processing loop."""
    global _process_task
    if _process_task and not _process_task.done():
        _process_task.cancel()
        _process_task = None
