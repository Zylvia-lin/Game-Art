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
    raw_params = row.get("input_params")
    if isinstance(raw_params, str):
        try:
            raw_params = json.loads(raw_params)
        except (json.JSONDecodeError, TypeError):
            raw_params = {}
    if not isinstance(raw_params, dict):
        raw_params = {}

    raw_urls = row.get("output_urls")
    if isinstance(raw_urls, str):
        try:
            raw_urls = json.loads(raw_urls)
        except (json.JSONDecodeError, TypeError):
            raw_urls = []
    if not isinstance(raw_urls, list):
        raw_urls = []

    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "tool_key": row["tool_key"],
        "input_params": raw_params,
        "status": row["status"],
        "output_urls": raw_urls,
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


async def get_project_tasks(
    project_id: str, status: str | None = None, tool_key: str | None = None,
) -> list[dict]:
    conditions = ["project_id = $1"]
    params: list = [project_id]
    idx = 2
    if status:
        conditions.append(f"status = ${idx}")
        params.append(status)
        idx += 1
    if tool_key:
        conditions.append(f"tool_key = ${idx}")
        params.append(tool_key)
        idx += 1
    where = " AND ".join(conditions)
    rows = await fetch_all(
        f"SELECT * FROM tasks WHERE {where} ORDER BY created_at DESC",
        *params,
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


async def delete_project_tasks(project_id: str, status: str | None = None) -> int:
    """Delete tasks for a project. If status given, only delete that status; otherwise delete completed+failed."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        if status:
            result = await conn.execute(
                "DELETE FROM tasks WHERE project_id = $1 AND status = $2",
                project_id, status,
            )
        else:
            result = await conn.execute(
                "DELETE FROM tasks WHERE project_id = $1 AND status IN ('completed', 'failed')",
                project_id,
            )
    # result is like "DELETE 5"
    parts = result.split()
    return int(parts[1]) if len(parts) > 1 else 0


async def delete_single_task(task_id: str) -> bool:
    """Delete a single task by ID, including its generations history."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM generations WHERE task_id = $1", task_id)
        result = await conn.execute("DELETE FROM tasks WHERE id = $1", task_id)
    return "DELETE 0" not in result


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

        # Write billing record (independent of task/image lifecycle)
        await _create_billing_record(
            task["project_id"],
            task["id"],
            task["tool_key"],
            task["input_params"],
            result["output_urls"],
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


# ── Billing ──────────────────────────────────────────────
# Seedream pricing:
#   Input image:  0.02 / image
#   Output ≤ 2.36M px:  0.30 / image
#   Output > 2.36M px:  0.60 / image
PIXEL_THRESHOLD = 2_360_000
INPUT_PRICE = 0.02
OUTPUT_PRICE_LOW = 0.30
OUTPUT_PRICE_HIGH = 0.60

# Tool name mapping for billing display
_TOOL_NAMES = {
    "text_to_image": "文生图",
    "image_to_image": "图生图",
    "inpaint": "局部重绘",
    "character_tpose": "角色T-Pose",
    "character_three_view": "角色三视图",
    "character_directions": "角色多方向",
    "character_part_split": "角色拆分",
    "prop_original": "道具原创",
    "prop_variant": "道具变体",
    "ui_layout_generate": "UI布局生成",
    "ui_component_place": "UI组件放置",
    "ui_component_split": "UI组件拆分",
    "scene_map_generate": "场景地图",
    "scene_map_split": "场景地图拆分",
    "animation_action": "动作生成",
}


def _calculate_cost(input_params: dict, output_urls: list) -> dict:
    """Calculate billing cost based on input/output and resolution."""
    # Count input images (img2img, inpaint have input images)
    input_image_count = 0
    if input_params.get("source_image"):
        input_image_count += 1
    if input_params.get("mask_image"):
        input_image_count += 1
    if input_params.get("reference_image"):
        input_image_count += 1

    # Count output images
    output_count = len(output_urls) if output_urls else 0
    if output_count == 0:
        return {"input_cost": 0, "output_cost": 0, "total_cost": 0, "total_pixels": 0}

    # Parse resolution to get total pixels
    resolution = input_params.get("resolution", "")
    total_pixels = 0
    if resolution and "x" in resolution:
        try:
            parts = resolution.lower().split("x")
            total_pixels = int(parts[0]) * int(parts[1])
        except (ValueError, IndexError):
            pass

    # Determine output price per image
    if total_pixels > 0 and total_pixels <= PIXEL_THRESHOLD:
        output_price = OUTPUT_PRICE_LOW
    elif total_pixels > PIXEL_THRESHOLD:
        output_price = OUTPUT_PRICE_HIGH
    else:
        # Fallback: no resolution info, assume high tier
        output_price = OUTPUT_PRICE_HIGH

    input_cost = round(input_image_count * INPUT_PRICE, 4)
    output_cost = round(output_count * output_price, 4)
    total_cost = round(input_cost + output_cost, 4)

    return {
        "input_cost": input_cost,
        "output_cost": output_cost,
        "total_cost": total_cost,
        "total_pixels": total_pixels,
    }


async def _create_billing_record(
    project_id: str,
    task_id: str,
    tool_key: str,
    input_params: dict,
    output_urls: list,
):
    """Create a billing record after task completion."""
    cost = _calculate_cost(input_params, output_urls)
    tool_name = _TOOL_NAMES.get(tool_key, tool_key)
    resolution = input_params.get("resolution", "")

    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO billing_records
               (project_id, task_id, tool_key, tool_name, image_count,
                resolution, total_pixels, input_cost, output_cost, total_cost, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'completed')""",
            project_id, task_id, tool_key, tool_name,
            len(output_urls) if output_urls else 0,
            resolution, cost["total_pixels"],
            cost["input_cost"], cost["output_cost"], cost["total_cost"],
        )


async def get_billing_stats(period: str = "daily", days: int = 30) -> list:
    """Get billing statistics grouped by date.
    period: 'daily' or 'monthly'
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        if period == "monthly":
            rows = await conn.fetch(
                """SELECT
                    TO_CHAR(created_at, 'YYYY-MM') as period,
                    COUNT(*) as task_count,
                    SUM(image_count) as total_images,
                    SUM(input_cost) as total_input_cost,
                    SUM(output_cost) as total_output_cost,
                    SUM(total_cost) as total_cost
                   FROM billing_records
                   WHERE created_at >= NOW() - INTERVAL '%s days'
                   GROUP BY TO_CHAR(created_at, 'YYYY-MM')
                   ORDER BY period DESC""",
                days,
            )
        else:
            rows = await conn.fetch(
                """SELECT
                    TO_CHAR(created_at, 'YYYY-MM-DD') as period,
                    COUNT(*) as task_count,
                    SUM(image_count) as total_images,
                    SUM(input_cost) as total_input_cost,
                    SUM(output_cost) as total_output_cost,
                    SUM(total_cost) as total_cost
                   FROM billing_records
                   WHERE created_at >= NOW() - INTERVAL '%s days'
                   GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
                   ORDER BY period DESC""",
                days,
            )
    return [dict(r) for r in rows]


async def get_billing_summary() -> dict:
    """Get overall billing summary."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT
                COUNT(*) as total_tasks,
                COALESCE(SUM(image_count), 0) as total_images,
                COALESCE(SUM(input_cost), 0) as total_input_cost,
                COALESCE(SUM(output_cost), 0) as total_output_cost,
                COALESCE(SUM(total_cost), 0) as total_cost
               FROM billing_records"""
        )
    return dict(row) if row else {}


async def get_billing_records(limit: int = 50, offset: int = 0) -> list:
    """Get billing records with pagination."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT * FROM billing_records
               ORDER BY created_at DESC
               LIMIT $1 OFFSET $2""",
            limit, offset,
        )
    return [dict(r) for r in rows]
