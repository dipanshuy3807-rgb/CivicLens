from sqlalchemy.orm import Session

from app.models.volunteer import Volunteer


SAMPLE_VOLUNTEERS = [
    {
        "name": "Rahul Patil",
        "skills": "cleanup,general",
        "location": "Virar West",
        "latitude": 19.45,
        "longitude": 72.81,
    },
    {
        "name": "Priya Sharma",
        "skills": "logistics,general",
        "location": "Virar East",
        "latitude": 19.46,
        "longitude": 72.82,
    },
    {
        "name": "Amit Jadhav",
        "skills": "rescue,general",
        "location": "Vasai Road",
        "latitude": 19.39,
        "longitude": 72.84,
    },
    {
        "name": "Sneha More",
        "skills": "technical,general",
        "location": "Vasai East",
        "latitude": 19.41,
        "longitude": 72.88,
    },
    {
        "name": "Karan Naik",
        "skills": "cleanup,general",
        "location": "Nallasopara West",
        "latitude": 19.42,
        "longitude": 72.82,
    },
    {
        "name": "Neha Sawant",
        "skills": "logistics,food,general",
        "location": "Nallasopara East",
        "latitude": 19.41,
        "longitude": 72.84,
    },
    {
        "name": "Farhan Shaikh",
        "skills": "rescue,medical,general",
        "location": "Arnala Beach",
        "latitude": 19.47,
        "longitude": 72.74,
    },
    {
        "name": "Meera Desai",
        "skills": "cleanup,technical,general",
        "location": "Virar Station",
        "latitude": 19.45,
        "longitude": 72.81,
    },
]


def seed_sample_volunteers(db: Session) -> list[Volunteer]:
    seeded_volunteers: list[Volunteer] = []

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
