"""Billing records API routes."""
from fastapi import APIRouter, Query
from services.task_queue import get_billing_stats, get_billing_summary, get_billing_records

router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.get("/summary")
async def billing_summary():
    """Get overall billing summary."""
    summary = await get_billing_summary()
    return summary


@router.get("/stats")
async def billing_stats(
    period: str = Query("daily", pattern="^(daily|monthly)$"),
    days: int = Query(30, ge=1, le=365),
):
    """Get billing statistics grouped by date."""
    stats = await get_billing_stats(period=period, days=days)
    return {"period": period, "days": days, "data": stats}


@router.get("/records")
async def billing_records(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Get billing records with pagination."""
    records = await get_billing_records(limit=limit, offset=offset)
    return {"records": records, "limit": limit, "offset": offset}
