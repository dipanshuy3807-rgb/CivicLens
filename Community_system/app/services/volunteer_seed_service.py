from sqlalchemy.orm import Session

from app.models.volunteer import Volunteer


SAMPLE_VOLUNTEERS = [
    {
        "name": "Rahul Patil",
        "skills": "cleanup",
        "location": "Virar West",
        "latitude": 19.45,
        "longitude": 72.81,
    },
    {
        "name": "Priya Sharma",
        "skills": "logistics",
        "location": "Virar East",
        "latitude": 19.46,
        "longitude": 72.82,
    },
    {
        "name": "Amit Jadhav",
        "skills": "infrastructure",
        "location": "Vasai Road",
        "latitude": 19.39,
        "longitude": 72.84,
    },
    {
        "name": "Sneha More",
        "skills": "infrastructure",
        "location": "Vasai East",
        "latitude": 19.41,
        "longitude": 72.88,
    },
    {
        "name": "Farhan Shaikh",
        "skills": "medical",
        "location": "Arnala Beach",
        "latitude": 19.47,
        "longitude": 72.74,
    },
    {
        "name": "Meera Desai",
        "skills": "cleanup,infrastructure",
        "location": "Virar Station",
        "latitude": 19.45,
        "longitude": 72.81,
    },
]

SAMPLE_VOLUNTEER_NAMES = {
    "Rahul Patil",
    "Priya Sharma",
    "Amit Jadhav",
    "Sneha More",
    "Karan Naik",
    "Neha Sawant",
    "Farhan Shaikh",
    "Meera Desai",
}


def seed_sample_volunteers(db: Session) -> list[Volunteer]:
    seeded_volunteers: list[Volunteer] = []
    current_names = {sample["name"] for sample in SAMPLE_VOLUNTEERS}
    stale_samples = (
        db.query(Volunteer)
        .filter(Volunteer.name.in_(SAMPLE_VOLUNTEER_NAMES - current_names))
        .all()
    )
    for stale_sample in stale_samples:
        db.delete(stale_sample)

    for sample in SAMPLE_VOLUNTEERS:
        existing = (
            db.query(Volunteer)
            .filter(Volunteer.name == sample["name"])
            .filter(Volunteer.location == sample["location"])
            .first()
        )
        if existing is not None:
            seeded_volunteers.append(existing)
            continue

        volunteer = Volunteer(**sample)
        db.add(volunteer)
        seeded_volunteers.append(volunteer)

    db.commit()

    for volunteer in seeded_volunteers:
        if volunteer.id is None:
            db.refresh(volunteer)

    return seeded_volunteers
