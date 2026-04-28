from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.volunteer import Volunteer
from app.services.volunteer_seed_service import seed_sample_volunteers

router = APIRouter()


class VolunteerCreate(BaseModel):
    name: str
    skills: list[str] | str
    location: str
    latitude: float | None = None
    longitude: float | None = None


@router.post("/volunteers")
def create_volunteer(payload: VolunteerCreate, db: Session = Depends(get_db)):
    volunteer = Volunteer(
        name=payload.name.strip(),
        skills=_normalize_skills(payload.skills),
        location=payload.location.strip(),
        latitude=payload.latitude,
        longitude=payload.longitude,
    )

    db.add(volunteer)
    db.commit()
    db.refresh(volunteer)

    return _serialize_volunteer(volunteer)


@router.get("/volunteers")
def get_volunteers(db: Session = Depends(get_db)):
    volunteers = (
        db.query(Volunteer)
        .order_by(Volunteer.created_at.desc())
        .all()
    )
    return [_serialize_volunteer(volunteer) for volunteer in volunteers]


@router.post("/volunteers/seed")
def seed_volunteers(db: Session = Depends(get_db)):
    volunteers = seed_sample_volunteers(db)
    return {
        "message": "sample employees seeded",
        "count": len(volunteers),
        "volunteers": [_serialize_volunteer(volunteer) for volunteer in volunteers],
    }

def _normalize_skills(skills: list[str] | str) -> str:
    if isinstance(skills, str):
        skill_items = skills.split(",")
    else:
        skill_items = skills

    normalized = []
    for skill in skill_items:
        cleaned_skill = skill.strip().lower()
        if cleaned_skill:
            normalized.append(cleaned_skill)

    return ",".join(normalized)


def _serialize_volunteer(volunteer: Volunteer) -> dict:
    return {
        "id": volunteer.id,
        "name": volunteer.name,
        "skills": [skill for skill in volunteer.skills.split(",") if skill],
        "location": volunteer.location,
        "latitude": volunteer.latitude,
        "longitude": volunteer.longitude,
        "created_at": volunteer.created_at.isoformat() if volunteer.created_at else None,
    }
