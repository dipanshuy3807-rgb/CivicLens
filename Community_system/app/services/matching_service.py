from sqlalchemy.orm import Session

from app.models.volunteer import Volunteer


ISSUE_SKILL_MAP = {
    "Garbage Overflow": "cleanup",
    "Water Shortage": "logistics",
    "Road Damage": "rescue",
    "Power Issue": "technical",
    "Sewage Problem": "cleanup",
}

DEFAULT_SKILL = "general"


def get_required_skill(issue_type: str | None) -> str:
    return ISSUE_SKILL_MAP.get(issue_type or "", DEFAULT_SKILL)


def match_volunteers(db: Session, issue) -> list[Volunteer]:
    required_skill = get_required_skill(issue.issue_type)

    volunteers = db.query(Volunteer).all()
    matching_volunteers = [
        volunteer
        for volunteer in volunteers
        if _has_skill(volunteer.skills, required_skill)
    ]

    issue_location = (issue.location or "").strip().lower()
    return sorted(
        matching_volunteers,
        key=lambda volunteer: (
            0 if (volunteer.location or "").strip().lower() == issue_location else 1,
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
