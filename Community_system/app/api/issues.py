from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.issue import Issue
from app.services.batch_service import get_latest_batch_id

router = APIRouter()


@router.get("/issues/history")
def get_issue_history(db: Session = Depends(get_db)):
    issues = (
        db.query(Issue)
        .order_by(Issue.created_at.desc())
        .all()
    )

    return [
        {
            "id": issue.id,
            "issue_type": issue.issue_type,
            "severity": issue.severity,
            "location": issue.location,
            "priority_score": issue.priority_score,
            "created_at": issue.created_at.isoformat() if issue.created_at else None,
            "batch_id": issue.batch_id,
        }
        for issue in issues
    ]


@router.get("/issues/history/summary")
def get_issue_history_summary(db: Session = Depends(get_db)):
    issues = (
        db.query(Issue)
        .order_by(Issue.created_at.desc())
        .all()
    )

    batches = {}
    for issue in issues:
        batch_key = issue.batch_id or "legacy"
        if batch_key not in batches:
            batches[batch_key] = {
                "batch_id": issue.batch_id,
                "issue_count": 0,
                "latest_created_at": issue.created_at.isoformat() if issue.created_at else None,
            }
        batches[batch_key]["issue_count"] += 1

    return {
        "total_past_issues": len(issues),
        "total_resolved_issues": 0,
        "batches": list(batches.values()),
    }


@router.get("/issues")
def get_issues(batch_id: str | None = Query(default=None), db: Session = Depends(get_db)):
    resolved_batch_id = batch_id or get_latest_batch_id(db)

    if resolved_batch_id is None:
        return []

    return (
        db.query(Issue)
        .filter(Issue.batch_id == resolved_batch_id)
        .order_by(Issue.priority_score.desc())
        .order_by(Issue.created_at.desc())
        .all()
    )


@router.get("/issues/{issue_id}")
def get_issue(issue_id: int, db: Session = Depends(get_db)):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if issue is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")

    return issue


@router.delete("/issues/{issue_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_issue(issue_id: int, db: Session = Depends(get_db)):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if issue is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")

    db.delete(issue)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
