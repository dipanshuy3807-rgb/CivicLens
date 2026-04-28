from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.issue import Issue

router = APIRouter()


@router.get("/dashboard")
def get_dashboard(db: Session = Depends(get_db)):
    total_issues = db.query(Issue).count()
    high_priority_issues = (
        db.query(Issue)
        .order_by(Issue.priority_score.desc())
        .order_by(Issue.created_at.desc())
        .limit(5)
        .all()
    )

    return {
        "total_issues": total_issues,
        "high_priority_issues": high_priority_issues,
    }
