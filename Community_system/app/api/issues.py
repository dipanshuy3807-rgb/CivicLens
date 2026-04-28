from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_role
from app.core.db import get_db
from app.models.issue import Issue
from app.models.user import User
from app.services.batch_service import get_latest_batch_id

router = APIRouter()


class VolunteerAssignmentRequest(BaseModel):
    issue_id: int
    volunteer_name: str


class UserAssignmentRequest(BaseModel):
    volunteer_id: int


@router.get("/issues/history")
def get_issue_history(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("ngo")),
):
    issues = (
        db.query(Issue)
        .order_by(Issue.created_at.desc())
        .all()
    )

    return [_serialize_issue(issue) for issue in issues]


@router.get("/issues/history/summary")
def get_issue_history_summary(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("ngo")),
):
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
def get_issues(
    batch_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("ngo")),
):
    resolved_batch_id = batch_id or get_latest_batch_id(db)

    if resolved_batch_id is None:
        return []

    issues = (
        db.query(Issue)
        .filter(Issue.batch_id == resolved_batch_id)
        .order_by(Issue.priority_score.desc())
        .order_by(Issue.created_at.desc())
        .all()
    )
    return [_serialize_issue(issue) for issue in issues]


@router.get("/issues/{issue_id}")
def get_issue(
    issue_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("ngo")),
):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if issue is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")

    return _serialize_issue(issue)


@router.post("/assign-volunteer")
def assign_volunteer(
    payload: VolunteerAssignmentRequest,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("ngo")),
):
    volunteer_name = payload.volunteer_name.strip()
    if not volunteer_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Volunteer name is required",
        )

    issue = db.query(Issue).filter(Issue.id == payload.issue_id).first()
    if issue is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")

    issue.assigned_volunteer = volunteer_name
    issue.status = "assigned"
    db.commit()
    db.refresh(issue)

    return {
        "success": True,
        "message": f"Assigned volunteer {volunteer_name} to issue {issue.id}",
        "issue": _serialize_issue(issue),
    }


@router.post("/issues/{issue_id}/assign")
def assign_issue_to_user(
    issue_id: int,
    payload: UserAssignmentRequest,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("ngo")),
):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if issue is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")

    volunteer = (
        db.query(User)
        .filter(User.id == payload.volunteer_id)
        .filter(User.role == "volunteer")
        .first()
    )
    if volunteer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Volunteer not found")

    issue.assigned_to = volunteer.id
    issue.assigned_volunteer = volunteer.name
    issue.status = "assigned"
    db.commit()
    db.refresh(issue)

    return {
        "success": True,
        "issue": _serialize_issue(issue),
    }


@router.get("/volunteer/tasks")
def get_volunteer_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("volunteer")),
):
    tasks = (
        db.query(Issue)
        .filter(Issue.assigned_to == current_user.id)
        .order_by(Issue.created_at.desc())
        .all()
    )
    return [_serialize_issue(issue) for issue in tasks]


@router.post("/issues/{issue_id}/accept")
def accept_issue(
    issue_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("volunteer")),
):
    issue = _get_assigned_issue(db, issue_id, current_user)
    issue.status = "accepted"
    db.commit()
    db.refresh(issue)
    return {"success": True, "issue": _serialize_issue(issue)}


@router.post("/issues/{issue_id}/reject")
def reject_issue(
    issue_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("volunteer")),
):
    issue = _get_assigned_issue(db, issue_id, current_user)
    issue.status = "rejected"
    db.commit()
    db.refresh(issue)
    return {"success": True, "issue": _serialize_issue(issue)}


@router.delete("/issues/{issue_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_issue(
    issue_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("ngo")),
):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if issue is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")

    db.delete(issue)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _serialize_issue(issue: Issue) -> dict:
    return {
        "id": issue.id,
        "batch_id": issue.batch_id,
        "issue_type": issue.issue_type,
        "severity": issue.severity,
        "people_affected": issue.people_affected,
        "location": issue.location,
        "latitude": issue.latitude,
        "longitude": issue.longitude,
        "priority_score": issue.priority_score,
        "assigned_volunteer": issue.assigned_volunteer,
        "assigned_to": issue.assigned_to,
        "status": issue.status,
        "created_at": issue.created_at.isoformat() if issue.created_at else None,
    }


def _get_assigned_issue(db: Session, issue_id: int, current_user: User) -> Issue:
    issue = (
        db.query(Issue)
        .filter(Issue.id == issue_id)
        .filter(Issue.assigned_to == current_user.id)
        .first()
    )
    if issue is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return issue

