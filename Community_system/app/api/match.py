from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.issue import Issue
from app.services.batch_service import get_latest_batch_id
from app.services.matching_service import get_required_skill, get_top_match, match_volunteers

router = APIRouter()


@router.get("/match/batch")
def get_batch_matches(
    batch_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    resolved_batch_id = batch_id or get_latest_batch_id(db)
    if resolved_batch_id is None:
        return {
            "batch_id": None,
            "assignments": [],
        }

    issues = (
        db.query(Issue)
        .filter(Issue.batch_id == resolved_batch_id)
        .order_by(Issue.priority_score.desc(), Issue.created_at.desc())
        .all()
    )

    return {
        "batch_id": resolved_batch_id,
        "assignments": [
            _serialize_assignment(issue, get_top_match(db, issue), get_required_skill(issue.issue_type))
            for issue in issues
        ],
    }


@router.get("/match/{issue_id}")
def get_issue_matches(issue_id: int, db: Session = Depends(get_db)):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if issue is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")

    required_skill = get_required_skill(issue.issue_type)
    matched_volunteers = match_volunteers(db, issue)

    return {
        "issue": _serialize_issue(issue),
        "required_skill": required_skill,
        "matched_volunteers": [
            _serialize_volunteer(volunteer) for volunteer in matched_volunteers
        ],
    }


def _serialize_volunteer(volunteer) -> dict:
    return {
        "id": volunteer.id,
        "name": volunteer.name,
        "skills": [skill for skill in volunteer.skills.split(",") if skill],
        "location": volunteer.location,
        "latitude": volunteer.latitude,
        "longitude": volunteer.longitude,
        "created_at": volunteer.created_at.isoformat() if volunteer.created_at else None,
    }


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
        "created_at": issue.created_at.isoformat() if issue.created_at else None,
    }


def _serialize_assignment(issue: Issue, volunteer, required_skill: str) -> dict:
    return {
        "issue": _serialize_issue(issue),
        "required_skill": required_skill,
        "assigned_employee": _serialize_volunteer(volunteer) if volunteer else None,
    }
