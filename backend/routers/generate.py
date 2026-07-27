"""
Generation endpoints.
Task submission and management via async task queue.
On-demand prompt optimization endpoint.
"""
import json
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from database import fetch_one, fetch_all, execute, get_pool
from services.task_queue import (
    create_task, get_task, get_project_tasks, get_queue_stats, cancel_task,
    delete_project_tasks, delete_single_task,
)
from services.llm_service import optimize_prompt

router = APIRouter(prefix="/api/generate", tags=["generate"])


class GenerateRequest(BaseModel):
    project_id: str
    model_id: Optional[str] = None
    prompt: Optional[str] = None
    style: Optional[str] = None
    ratio: Optional[str] = None
    resolution: Optional[str] = None
    image_url: Optional[str] = None
    mask_url: Optional[str] = None
    pose: Optional[str] = None
    reference_url: Optional[str] = None
    strength: Optional[float] = None
    directions: Optional[int] = None
    frame_count: Optional[int] = None
    action: Optional[str] = None
    variant_count: Optional[int] = None
    layout_type: Optional[str] = None
    map_type: Optional[str] = None
    tile_size: Optional[int] = None
    components: Optional[list] = None
    sub_tool: Optional[str] = None
    original_width: Optional[int] = None
    original_height: Optional[int] = None


# Tools that don't need AI models (local processing only)
LOCAL_ONLY_TOOLS = {"animation_frame_extract", "ui_component_place", "ui_component_split", "scene_map_split"}


class OptimizePromptRequest(BaseModel):
    prompt: str
    tool_key: Optional[str] = None


class CreateCompletedTaskRequest(BaseModel):
    project_id: str
    tool_key: str
    output_url: str
    output_name: Optional[str] = None


@router.post("/task/completed", status_code=201)
async def create_completed_task(data: CreateCompletedTaskRequest):
    """Create a pre-completed task with a single output URL.
    Used by client-side image processing (e.g. background removal) to save
    results into the generation history without going through the AI pipeline."""
    import json as _json
    from datetime import datetime, timezone

    project = await fetch_one("SELECT id FROM projects WHERE id = $1", data.project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"项目 {data.project_id} 不存在")

    now = datetime.now(timezone.utc)
    row = await fetch_one(
        """INSERT INTO tasks (project_id, tool_key, input_params, status, progress,
                               output_urls, output_names, created_at, updated_at, completed_at)
           VALUES ($1, $2, $3::jsonb, 'completed', 100,
                   $4::jsonb, $5::jsonb, $6, $6, $6)
           RETURNING id""",
        data.project_id,
        data.tool_key,
        _json.dumps({"source": "local_processing"}),
        _json.dumps([data.output_url]),
        _json.dumps([data.output_name] if data.output_name else [None]),
        now,
    )
    if not row:
        raise HTTPException(status_code=500, detail="Failed to create task")
    return {"status": "completed", "task_id": row["id"], "message": "Task created"}


@router.post("/optimize-prompt")
async def optimize_user_prompt(data: OptimizePromptRequest):
    """On-demand prompt optimization using LLM (DeepSeek etc.).
    Called when user clicks the optimize button next to the prompt input."""
    if not data.prompt or not data.prompt.strip():
        raise HTTPException(status_code=400, detail="提示词不能为空")

    # Load default text model config (full record with pricing)
    model = await fetch_one(
        "SELECT * FROM model_configs WHERE type = 'text' AND is_default = true LIMIT 1"
    )
    if not model:
        raise HTTPException(
            status_code=400,
            detail="未配置文本模型，请先在「模型配置」页面添加文本模型API密钥",
        )

    optimized = await optimize_prompt(
        user_prompt=data.prompt,
        model=model,
        tool_key=data.tool_key,
    )

    # Estimate token usage (chars → tokens)
    # Chinese ~1.5 chars/token, English ~4 chars/token, use avg 2.5
    input_chars = len(data.prompt)
    output_chars = len(optimized)
    estimated_input_tokens = input_chars / 2.5
    estimated_output_tokens = output_chars / 2.5
    input_units = round(estimated_input_tokens / 1_000_000, 6)  # per 1M tokens
    output_units = round(estimated_output_tokens / 1_000_000, 6)

    # Calculate cost from model pricing
    input_unit_price = float(model.get("input_price", 0) or 0)
    output_unit_price = float(model.get("output_price", 0) or 0)
    input_cost = round(input_units * input_unit_price, 8)
    output_cost = round(output_units * output_unit_price, 8)
    total_cost = round(input_cost + output_cost, 8)

    # Create billing record
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO billing_records
                   (project_id, tool_key, tool_name, image_count,
                    model_id, model_name, unit_type,
                    input_units, output_units,
                    input_unit_price, output_unit_price,
                    input_cost, output_cost, total_cost, status)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'completed')""",
                None,  # project_id — null for standalone optimization
                "prompt_optimize",
                "提示词优化",
                0,
                model.get("id"),
                model.get("name"),
                "per_1M_tokens",
                input_units, output_units,
                input_unit_price, output_unit_price,
                input_cost, output_cost, total_cost,
            )
    except Exception as e:
        print(f"Failed to create billing record for prompt optimization: {e}")

    return {"optimized_prompt": optimized}


@router.post("/{tool_key}", status_code=201)
async def submit_generation(tool_key: str, data: GenerateRequest):
    """Submit a new generation task to the queue."""
    if not data.project_id:
        raise HTTPException(status_code=400, detail="project_id is required")

    # Validate project exists
    project = await fetch_one("SELECT id FROM projects WHERE id = $1", data.project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"项目 {data.project_id} 不存在")

    # Check model configuration for AI-dependent tools
    if tool_key not in LOCAL_ONLY_TOOLS:
        # Validate specific model if provided, otherwise check default exists
        if data.model_id:
            specific_model = await fetch_one(
                "SELECT id, type FROM model_configs WHERE id = $1", data.model_id
            )
            if not specific_model:
                raise HTTPException(status_code=400, detail=f"指定的模型 {data.model_id} 不存在")
            if specific_model["type"] != "image":
                raise HTTPException(
                    status_code=400,
                    detail=f"指定的模型类型为 {specific_model['type']}，图片生成需要 image 类型模型",
                )
        else:
            image_model = await fetch_one(
                "SELECT id FROM model_configs WHERE type = 'image' AND is_default = true LIMIT 1"
            )
            if not image_model:
                raise HTTPException(
                    status_code=400,
                    detail="未配置图片模型，请先在「模型配置」页面添加图片模型API密钥",
                )

        text_model = await fetch_one(
            "SELECT id FROM model_configs WHERE type = 'text' AND is_default = true LIMIT 1"
        )
        if not text_model:
            raise HTTPException(
                status_code=400,
                detail="未配置文本模型，请先在「模型配置」页面添加文本模型（如DeepSeek）API密钥",
            )

    # Build input params from request
    input_params = data.model_dump(exclude={"project_id"}, exclude_none=True)

    task = await create_task(data.project_id, tool_key, input_params)

    return {
        "status": "queued",
        "task_id": task["id"],
        "message": "Task added to queue",
    }


@router.get("/task")
async def get_task_info(
    task_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    tool_key: Optional[str] = Query(None),
    stats: Optional[bool] = Query(None),
):
    """Get task info, project tasks, or queue stats."""
    if stats:
        return await get_queue_stats(project_id)

    if task_id:
        task = await get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        return task

    if project_id:
        return await get_project_tasks(project_id, status, tool_key)

    raise HTTPException(status_code=400, detail="task_id, project_id, or stats required")


@router.post("/task/{task_id}/cancel")
async def cancel_generation_task(task_id: str):
    """Cancel a pending or processing task."""
    task = await cancel_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found or already completed")
    return task


@router.delete("/task")
async def delete_tasks(
    project_id: str = Query(...),
    status: Optional[str] = Query(None),
):
    """Delete tasks for a project. If status is given, only delete tasks with that status.
    If no status, delete all completed and failed tasks."""
    deleted = await delete_project_tasks(project_id, status)
    return {"deleted": deleted}


@router.delete("/task/{task_id}")
async def delete_single(task_id: str):
    """Delete a single task and its generations history."""
    ok = await delete_single_task(task_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"success": True}


class RenameOutputRequest(BaseModel):
    index: int
    name: str


@router.patch("/task/{task_id}/rename")
async def rename_output(task_id: str, req: RenameOutputRequest):
    """Rename a specific output image in a task."""
    row = await fetch_one(
        "SELECT output_names FROM tasks WHERE id = $1",
        task_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")

    raw_names = row.get("output_names")
    if isinstance(raw_names, str):
        try:
            names = json.loads(raw_names)
        except (json.JSONDecodeError, TypeError):
            names = []
    else:
        names = raw_names or []

    # Ensure list is long enough
    while len(names) <= req.index:
        names.append(None)
    names[req.index] = req.name.strip() or f"output_{req.index+1}"

    await execute(
        "UPDATE tasks SET output_names = $1::jsonb WHERE id = $2",
        names,
        task_id,
    )
    return {"success": True, "name": names[req.index]}


@router.delete("/task/{task_id}/output/{index}")
async def delete_output(task_id: str, index: int):
    """Delete a single output image from a task by index."""
    row = await fetch_one(
        "SELECT output_urls, output_names FROM tasks WHERE id = $1",
        task_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")

    raw_urls = row.get("output_urls")
    if isinstance(raw_urls, str):
        try:
            urls = json.loads(raw_urls)
        except (json.JSONDecodeError, TypeError):
            urls = []
    else:
        urls = raw_urls or []

    raw_names = row.get("output_names")
    if isinstance(raw_names, str):
        try:
            names = json.loads(raw_names)
        except (json.JSONDecodeError, TypeError):
            names = []
    else:
        names = raw_names or []

    if index < 0 or index >= len(urls):
        raise HTTPException(status_code=400, detail="Index out of range")

    urls.pop(index)
    if index < len(names):
        names.pop(index)

    await execute(
        "UPDATE tasks SET output_urls = $1::jsonb, output_names = $2::jsonb WHERE id = $3",
        urls,
        names,
        task_id,
    )
    return {"success": True, "remaining": len(urls)}
