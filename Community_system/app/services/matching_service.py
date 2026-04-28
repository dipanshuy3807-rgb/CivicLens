from sqlalchemy.orm import Session

from app.models.user import User
from app.models.volunteer import Volunteer


ISSUE_SKILL_MAP = {
    "Garbage Overflow": "cleanup",
    "Water Shortage": "logistics",
    "Road Damage": "infrastructure",
    "Power Issue": "infrastructure",
    "Sewage Problem": "cleanup",
}

DEFAULT_SKILL = "general"
AVAILABILITY_RANK = {
    "full-time": 0,
    "part-time": 1,
    "weekends": 2,
}


def get_required_skill(issue_type: str | None) -> str:
    return ISSUE_SKILL_MAP.get(issue_type or "", DEFAULT_SKILL)


def match_volunteers(db: Session, issue) -> list[Volunteer]:
    required_skill = get_required_skill(issue.issue_type)
    volunteer_users = (
        db.query(User)
        .filter(User.role == "volunteer")
        .filter(User.skill.isnot(None))
        .filter(User.location.isnot(None))
        .filter(User.availability.isnot(None))
        .all()
    )
    user_matches = [
        volunteer
        for volunteer in volunteer_users
        if _has_skill(volunteer.skill, required_skill)
    ]

    sample_volunteers = db.query(Volunteer).all()
    sample_matches = [
        volunteer
        for volunteer in sample_volunteers
        if _has_skill(volunteer.skills, required_skill)
    ]

    matching_volunteers = user_matches or sample_matches
    issue_location = (issue.location or "").strip().lower()
    return sorted(
        matching_volunteers,
        key=lambda volunteer: (
            _skill_score(volunteer, required_skill),
            _location_score(volunteer, issue_location),
            _availability_score(volunteer),
            volunteer.created_at,
        ),
    )


def get_top_match(db: Session, issue) -> Volunteer | None:
    matching_volunteers = match_volunteers(db, issue)
    if not matching_volunteers:
        return None
    return matching_volunteers[0]


def _has_skill(skills: str | None, required_skill: str) -> bool:
    normalized_skills = {
        skill.strip().lower()
        for skill in (skills or "").split(",")
        if skill.strip()
    }
    return required_skill in normalized_skills or DEFAULT_SKILL in normalized_skills


def _skill_score(volunteer, required_skill: str) -> int:
    skills = getattr(volunteer, "skill", None) or getattr(volunteer, "skills", None)
    normalized_skills = {
        skill.strip().lower()
        for skill in (skills or "").split(",")
        if skill.strip()
    }
    if required_skill in normalized_skills:
        return 0
    if DEFAULT_SKILL in normalized_skills:
        return 1
    return 2


def _location_score(volunteer, issue_location: str) -> int:
    volunteer_location = (volunteer.location or "").strip().lower()
    if not volunteer_location or not issue_location:
        return 2
    if volunteer_location == issue_location:
        return 0
    if volunteer_location in issue_location or issue_location in volunteer_location:
        return 1
    return 2


def _availability_score(volunteer) -> int:
    availability = (getattr(volunteer, "availability", None) or "").strip().lower()
    return AVAILABILITY_RANK.get(availability, 3)
