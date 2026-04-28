from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.issue import Issue
from app.services.batch_service import get_latest_batch_id

router = APIRouter()


@router.get("/analytics/heatmap")
def get_heatmap_data(batch_id: str | None = Query(default=None), db: Session = Depends(get_db)):
    resolved_batch_id = batch_id or get_latest_batch_id(db)
    if resolved_batch_id is None:
        return []

    heatmap_rows = (
        db.query(
            Issue.latitude.label("lat"),
            Issue.longitude.label("lng"),
            func.sum(Issue.priority_score).label("intensity"),
        )
        .filter(Issue.batch_id == resolved_batch_id)
        .filter(Issue.latitude.isnot(None))
        .filter(Issue.longitude.isnot(None))
        .group_by(Issue.latitude, Issue.longitude)
        .all()
    )

    return [
        {
            "lat": row.lat,
            "lng": row.lng,
            "intensity": float(row.intensity or 0),
        }
        for row in heatmap_rows
    ]
