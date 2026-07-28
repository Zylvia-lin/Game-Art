"""
Async task queue service.
Manages generation tasks with background asyncio processing.
"""
import asyncio
import json
from datetime import datetime, timezone
from database import get_pool, fetch_one, fetch_all
from services.generate_service import execute_generation

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

    raw_names = row.get("output_names")
    if isinstance(raw_names, str):
        try:
            raw_names = json.loads(raw_names)
        except (json.JSONDecodeError, TypeError):
            raw_names = []
    if not isinstance(raw_names, list):
        raw_names = []

    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "tool_key": row["tool_key"],
        "input_params": raw_params,
        "status": row["status"],
        "output_urls": raw_urls,
        "output_names": raw_names,
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
            project_id, tool_key, input_params,
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


async def fail_interrupted_tasks() -> int:
    """Mark tasks left processing by a previous server process as failed."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            """UPDATE tasks
               SET status = 'failed',
                   error_message = '服务重启导致任务中断，请重新提交',
                   completed_at = NOW(),
                   updated_at = NOW()
               WHERE status = 'processing'"""
        )
    parts = result.split()
    return int(parts[1]) if len(parts) > 1 else 0


async def update_task_status(
    task_id: str,
    status: str,
    output_urls: list | None = None,
    output_names: list | None = None,
    error_message: str | None = None,
    progress: int | None = None,
    expected_status: str | None = None,
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
                 output_names = COALESCE($4::jsonb, output_names),
                 error_message = COALESCE($5, error_message),
                 progress = COALESCE($6, progress),
                 started_at = COALESCE(started_at, $7),
                 completed_at = COALESCE($8, completed_at),
                 updated_at = $9
               WHERE id = $1 AND ($10::varchar IS NULL OR status = $10)
               RETURNING *""",
            task_id, status,
            output_urls if output_urls else None,
            output_names if output_names else None,
            error_message, progress,
            started_at, completed_at, now, expected_status,
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


async def delete_output_image(task_id: str, index: int) -> dict:
    """Delete a single output image from a task's output_urls array.
    Removes the image at the given index, updates both tasks and generations tables.
    If this was the last image, deletes the entire task."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT output_urls, output_names FROM tasks WHERE id = $1",
            task_id,
        )
        if not row:
            return {"deleted": False, "reason": "task not found"}

        output_urls = row["output_urls"] or []
        output_names = row["output_names"] or []

        if index < 0 or index >= len(output_urls):
            return {"deleted": False, "reason": "index out of range"}

        url_to_delete = output_urls[index]

        new_urls = output_urls[:index] + output_urls[index + 1:]
        new_names = output_names[:index] + output_names[index + 1:] if len(output_names) > index else output_names

        if len(new_urls) == 0:
            await conn.execute("DELETE FROM generations WHERE task_id = $1", task_id)
            await conn.execute("DELETE FROM tasks WHERE id = $1", task_id)
            return {"deleted": True, "url": url_to_delete, "task_removed": True}

        await conn.execute(
            "UPDATE tasks SET output_urls = $1::jsonb, output_names = $2::jsonb WHERE id = $3",
            new_urls, new_names, task_id,
        )

        gen_row = await conn.fetchrow(
            "SELECT id FROM generations WHERE task_id = $1",
            task_id,
        )
        if gen_row:
            await conn.execute(
                "UPDATE generations SET output_urls = $1::jsonb, output_names = $2::jsonb WHERE task_id = $3",
                new_urls, new_names, task_id,
            )

        try:
            file_path = url_to_delete.lstrip("/")
            import os
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception:
            pass

        return {"deleted": True, "url": url_to_delete, "task_removed": False}


async def _claim_next_pending_task() -> dict | None:
    """Atomically claim one pending task so it can only have one worker."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """WITH next_task AS (
                   SELECT id FROM tasks
                   WHERE status = 'pending'
                   ORDER BY created_at ASC
                   LIMIT 1
                   FOR UPDATE SKIP LOCKED
               )
               UPDATE tasks
               SET status = 'processing',
                   progress = 10,
                   started_at = COALESCE(started_at, NOW()),
                   updated_at = NOW()
               FROM next_task
               WHERE tasks.id = next_task.id
               RETURNING tasks.*"""
        )
        return _to_task(dict(row)) if row else None


async def _process_single_task(task: dict):
    """Process a single generation task."""
    try:
        async def on_progress(pct: int):
            await update_task_status(
                task["id"], "processing", progress=pct,
                expected_status="processing",
            )

        # Look up model config: prefer model_id from input_params, fallback to default
        model_config = None
        model_id = task["input_params"].get("model_id")
        if model_id:
            model_config = await fetch_one(
                "SELECT * FROM model_configs WHERE id = $1", model_id
            )
        if not model_config:
            model_config = await fetch_one(
                "SELECT * FROM model_configs WHERE type = 'image' AND is_default = true LIMIT 1"
            )
        if not model_config:
            model_config = await fetch_one(
                "SELECT * FROM model_configs WHERE type = 'image' LIMIT 1"
            )

        result = await execute_generation(
            task["tool_key"],
            task["input_params"],
            on_progress,
            model_config,
        )

        # Generate default output names
        default_names = [f"output_{i+1}" for i in range(len(result["output_urls"]))]

        completed_task = await update_task_status(
            task["id"], "completed",
            output_urls=result["output_urls"],
            output_names=default_names,
            progress=100,
            expected_status="processing",
        )
        if not completed_task:
            return

        # Save to generations history
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO generations (project_id, task_id, tool_key, input_params, output_urls, output_names, status)
                   VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, 'completed')""",
                task["project_id"], task["id"], task["tool_key"],
                task["input_params"],
                result["output_urls"],
                default_names,
            )

        # Write billing record (independent of task/image lifecycle)
        await _create_billing_record(
            task["project_id"],
            task["id"],
            task["tool_key"],
            task["input_params"],
            result["output_urls"],
            model_config,
        )

    except Exception as e:
        print(f"Task {task['id']} failed: {e}")
        await update_task_status(
            task["id"], "failed",
            error_message=str(e),
            expected_status="processing",
        )


async def _process_queue():
    """Background loop that processes pending tasks concurrently without limits."""
    while True:
        try:
            task = await _claim_next_pending_task()
            if task:
                asyncio.create_task(_process_single_task(task))
            else:
                await asyncio.sleep(2)
        except Exception as e:
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
# Fallback defaults (used when model config has no pricing set)
_FALLBACK_PIXEL_THRESHOLD = 2_360_000
_FALLBACK_INPUT_PRICE = 0.02
_FALLBACK_OUTPUT_PRICE_LOW = 0.30
_FALLBACK_OUTPUT_PRICE_HIGH = 0.60

# Tool name mapping for billing display
_TOOL_NAMES = {
    "text_to_image": "文生图",
    "image_to_image": "图生图",
    "inpaint": "局部重绘",
    "image_edit": "图片编辑",
    "character_tpose": "角色T-Pose",
    "character_three_view": "角色三视图",
    "character_directions": "角色多方向",
    "character_part_split": "角色拆分",
    "prop_generate": "道具生成",
    "prop_variant": "道具变体",
    "ui_layout_generate": "UI布局生成",
    "ui_component_place": "UI组件放置",
    "ui_component_split": "UI组件拆分",
    "scene_map_generate": "场景地图",
    "scene_map_split": "场景地图拆分",
    "animation_video_generate": "动作生成",
    "remove_bg": "去除背景",
    "prompt_optimize": "提示词优化",
}


def _calculate_cost(input_params: dict, output_urls: list, model_config: dict | None = None) -> dict:
    """Calculate billing cost based on model-specific pricing.
    Falls back to hardcoded defaults when model_config has no pricing set."""
    # Count input images (img2img, inpaint, etc.)
    input_image_count = 0
    if input_params.get("image_url"):
        input_image_count += 1
    if input_params.get("mask_url"):
        input_image_count += 1

    # Count output images
    output_count = len(output_urls) if output_urls else 0
    if output_count == 0:
        return {"input_cost": 0, "output_cost": 0, "total_cost": 0,
                "total_pixels": 0, "input_units": 0, "output_units": 0}

    # Get model-driven pricing (with fallback)
    price_unit = (model_config or {}).get("price_unit", "per_image") or "per_image"
    input_unit_price = float((model_config or {}).get("input_price", 0) or 0)
    output_unit_price = float((model_config or {}).get("output_price", 0) or 0)
    output_price_high = float((model_config or {}).get("output_price_high", 0) or 0)
    pixel_threshold = int((model_config or {}).get("pixel_threshold", 0) or 0)

    # Parse resolution to get total pixels
    resolution = input_params.get("resolution", "")
    total_pixels = 0
    if resolution and "x" in resolution:
        try:
            parts = resolution.lower().split("x")
            total_pixels = int(parts[0]) * int(parts[1])
        except (ValueError, IndexError):
            pass

    # Determine tiered output price for image models
    if price_unit == "per_image":
        if output_price_high > 0 and pixel_threshold > 0 and total_pixels > pixel_threshold:
            output_unit_price = output_price_high
    # (text/tool models use flat output_unit_price as-is)

    # Fallback to hardcoded defaults only when no model is configured at all.
    # When a model exists, 0 means "free / not configured" — no fallback.
    if not model_config:
        if input_unit_price == 0:
            input_unit_price = _FALLBACK_INPUT_PRICE
        if output_unit_price == 0:
            if total_pixels > 0 and total_pixels <= _FALLBACK_PIXEL_THRESHOLD:
                output_unit_price = _FALLBACK_OUTPUT_PRICE_LOW
            elif total_pixels > _FALLBACK_PIXEL_THRESHOLD:
                output_unit_price = _FALLBACK_OUTPUT_PRICE_HIGH
            else:
                output_unit_price = _FALLBACK_OUTPUT_PRICE_HIGH

    input_units = input_image_count
    output_units = output_count

    input_cost = round(input_units * input_unit_price, 4)
    output_cost = round(output_units * output_unit_price, 4)
    total_cost = round(input_cost + output_cost, 4)

    return {
        "input_cost": input_cost,
        "output_cost": output_cost,
        "total_cost": total_cost,
        "total_pixels": total_pixels,
        "input_units": input_units,
        "output_units": output_units,
        "input_unit_price": input_unit_price,
        "output_unit_price": output_unit_price,
        "unit_type": price_unit,
    }


async def _create_billing_record(
    project_id: str,
    task_id: str,
    tool_key: str,
    input_params: dict,
    output_urls: list,
    model_config: dict | None = None,
):
    """Create a billing record after task completion."""
    cost = _calculate_cost(input_params, output_urls, model_config)
    tool_name = _TOOL_NAMES.get(tool_key, tool_key)
    resolution = input_params.get("resolution", "")

    model_id = (model_config or {}).get("id")
    model_name = (model_config or {}).get("name")

    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO billing_records
               (project_id, task_id, tool_key, tool_name, image_count,
                resolution, total_pixels, input_cost, output_cost, total_cost,
                model_id, model_name, unit_type,
                input_units, output_units, input_unit_price, output_unit_price,
                status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'completed')""",
            project_id, task_id, tool_key, tool_name,
            len(output_urls) if output_urls else 0,
            resolution, cost["total_pixels"],
            cost["input_cost"], cost["output_cost"], cost["total_cost"],
            model_id, model_name, cost["unit_type"],
            cost["input_units"], cost["output_units"],
            cost["input_unit_price"], cost["output_unit_price"],
        )


def _build_billing_where(base_where: str, params: list, project_id: str | None = None, model_type: str | None = None) -> tuple[str, list]:
    """Append optional filter conditions to a WHERE clause."""
    conditions = [base_where]
    idx = len(params) + 1
    if project_id:
        conditions.append(f"project_id = ${idx}")
        params.append(project_id)
        idx += 1
    if model_type:
        conditions.append(f"unit_type = ${idx}")
        params.append(model_type)
        idx += 1
    return " AND ".join(conditions), params


async def get_billing_stats(
    period: str = "daily", days: int = 30,
    project_id: str | None = None, model_type: str | None = None,
) -> list:
    """Get billing statistics grouped by date."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        fmt = "'YYYY-MM'" if period == "monthly" else "'YYYY-MM-DD'"
        base_where = f"created_at >= NOW() - make_interval(days => $1)"
        where, params = _build_billing_where(base_where, [days], project_id, model_type)
        rows = await conn.fetch(
            f"""SELECT
                    TO_CHAR(created_at, {fmt}) as period,
                    COUNT(*) as task_count,
                    SUM(image_count) as total_images,
                    SUM(input_cost) as total_input_cost,
                    SUM(output_cost) as total_output_cost,
                    SUM(total_cost) as total_cost
                FROM billing_records
                WHERE {where}
                GROUP BY TO_CHAR(created_at, {fmt})
                ORDER BY period DESC""",
            *params,
        )
    return [dict(r) for r in rows]


async def get_billing_summary(
    project_id: str | None = None, model_type: str | None = None,
) -> dict:
    """Get overall billing summary, optionally filtered."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        conditions = ["1=1"]
        params = []
        idx = 1
        if project_id:
            conditions.append(f"project_id = ${idx}")
            params.append(project_id)
            idx += 1
        if model_type:
            conditions.append(f"unit_type = ${idx}")
            params.append(model_type)
            idx += 1
        where = " AND ".join(conditions)
        row = await conn.fetchrow(
            f"""SELECT
                    COUNT(*) as total_tasks,
                    COALESCE(SUM(image_count), 0) as total_images,
                    COALESCE(SUM(input_cost), 0) as total_input_cost,
                    COALESCE(SUM(output_cost), 0) as total_output_cost,
                    COALESCE(SUM(total_cost), 0) as total_cost
                FROM billing_records WHERE {where}""",
            *params,
        )
    return dict(row) if row else {}


async def get_billing_records(
    limit: int = 50, offset: int = 0,
    project_id: str | None = None, model_type: str | None = None,
) -> list:
    """Get billing records with pagination and optional filters."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        params = [limit, offset]
        conditions = ["1=1"]
        idx = 3
        if project_id:
            conditions.append(f"project_id = ${idx}")
            params.append(project_id)
            idx += 1
        if model_type:
            conditions.append(f"unit_type = ${idx}")
            params.append(model_type)
            idx += 1
        where = " AND ".join(conditions)
        rows = await conn.fetch(
            f"""SELECT * FROM billing_records
                WHERE {where}
                ORDER BY created_at DESC
                LIMIT $1 OFFSET $2""",
            *params,
        )
    return [dict(r) for r in rows]


async def get_billing_records_export(
    dt_from, dt_to,
    project_id: str | None = None, model_type: str | None = None,
) -> list:
    """Get all billing records in a date range for export (no pagination)."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        params = [dt_from, dt_to]
        conditions = ["created_at >= $1", "created_at < $2"]
        idx = 3
        if project_id:
            conditions.append(f"project_id = ${idx}")
            params.append(project_id)
            idx += 1
        if model_type:
            conditions.append(f"unit_type = ${idx}")
            params.append(model_type)
            idx += 1
        where = " AND ".join(conditions)
        rows = await conn.fetch(
            f"SELECT * FROM billing_records WHERE {where} ORDER BY created_at DESC",
            *params,
        )
    return [dict(r) for r in rows]


async def get_distinct_projects() -> list:
    """Get distinct projects with billing records."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT DISTINCT br.project_id, p.name as project_name
               FROM billing_records br
               LEFT JOIN projects p ON br.project_id = p.id
               WHERE br.project_id IS NOT NULL
               ORDER BY p.name"""
        )
    return [dict(r) for r in rows]
