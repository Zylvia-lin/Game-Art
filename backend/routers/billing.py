"""Billing records API routes."""
import csv
import io
from datetime import datetime, timedelta
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from services.task_queue import (
    get_billing_stats, get_billing_summary, get_billing_records,
    get_billing_records_export, get_distinct_projects,
)

router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.get("/summary")
async def billing_summary(
    project_id: str | None = Query(None),
    model_type: str | None = Query(None),
):
    """Get overall billing summary, optionally filtered by project/model type."""
    summary = await get_billing_summary(project_id, model_type)
    return summary


@router.get("/stats")
async def billing_stats(
    period: str = Query("daily", pattern="^(daily|monthly)$"),
    days: int = Query(30, ge=1, le=365),
    project_id: str | None = Query(None),
    model_type: str | None = Query(None),
):
    """Get billing statistics grouped by date."""
    stats = await get_billing_stats(
        period=period, days=days, project_id=project_id, model_type=model_type
    )
    return {"period": period, "days": days, "data": stats}


@router.get("/records")
async def billing_records(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    project_id: str | None = Query(None),
    model_type: str | None = Query(None),
):
    """Get billing records with pagination and optional filters."""
    records = await get_billing_records(
        limit=limit, offset=offset, project_id=project_id, model_type=model_type
    )
    return {"records": records, "limit": limit, "offset": offset}


@router.get("/projects")
async def billing_projects():
    """Get distinct projects that have billing records."""
    projects = await get_distinct_projects()
    return projects


@router.get("/export")
async def billing_export(
    date_from: str = Query(..., description="Start date YYYY-MM-DD"),
    date_to: str = Query(..., description="End date YYYY-MM-DD"),
    project_id: str | None = Query(None),
    model_type: str | None = Query(None),
):
    """Export billing records as CSV for a date range."""
    try:
        dt_from = datetime.strptime(date_from, "%Y-%m-%d")
        dt_to = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="日期格式错误，应为 YYYY-MM-DD")

    records = await get_billing_records_export(dt_from, dt_to, project_id, model_type)

    output = io.StringIO()
    output.write('﻿')  # BOM for Excel UTF-8
    writer = csv.writer(output)
    writer.writerow([
        "日期", "工具", "模型", "计价单位",
        "输入消耗", "输出消耗",
        "输入单价", "输出单价",
        "输入费用", "输出费用", "合计",
    ])
    for r in records:
        unit_label = {
            "per_image": "张",
            "per_1M_tokens": "百万token",
            "per_1k_calls": "千次",
        }.get(r.get("unit_type", ""), "")
        writer.writerow([
            str(r.get("created_at", ""))[:10],
            r.get("tool_name") or r.get("tool_key", ""),
            r.get("model_name") or "-",
            unit_label,
            f"{float(r.get('input_units', 0) or 0):.4f}",
            f"{float(r.get('output_units', 0) or 0):.4f}",
            f"{float(r.get('input_unit_price', 0) or 0):.6f}",
            f"{float(r.get('output_unit_price', 0) or 0):.6f}",
            f"{float(r.get('input_cost', 0) or 0):.4f}",
            f"{float(r.get('output_cost', 0) or 0):.4f}",
            f"{float(r.get('total_cost', 0) or 0):.4f}",
        ])

    output.seek(0)
    filename = f"billing_{date_from}_{date_to}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
