from datetime import datetime, timedelta

from sqlalchemy import func

from app.models.issue import Issue


def is_duplicate(db, issue_data: dict) -> bool:
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    location = (issue_data.get("location") or "").strip().lower()
    issue_type = issue_data.get("issue_type")
    people_affected = max(issue_data.get("people_affected", 0), 0)

    if not issue_type or not location:
        return False

    recent_issues = (
        db.query(Issue)
        .filter(Issue.issue_type == issue_type)
        .filter(func.lower(Issue.location) == location)
        .filter(Issue.created_at >= one_hour_ago)
        .all()
    )

    for issue in recent_issues:
        if _people_difference_ratio(issue.people_affected, people_affected) < 0.2:
            return True

    return False


def _people_difference_ratio(existing_people: int, new_people: int) -> float:
    existing_value = max(existing_people, 0)
    new_value = max(new_people, 0)
    baseline = max(existing_value, new_value, 1)
    return abs(existing_value - new_value) / baseline
