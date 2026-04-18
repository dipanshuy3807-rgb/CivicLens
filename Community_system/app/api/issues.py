from fastapi import APIRouter
from app.core.db import SessionLocal
from app.models.issue import Issue

router = APIRouter()

@router.post("/add-issue")
def add_issue():
    db = SessionLocal()

    new_issue = Issue(
        issue_type="Water Shortage",
        severity="High",
        people_affected=120,
        location="Virar East"
    )

    db.add(new_issue)
    db.commit()
    db.close()

    return {"message": "Issue added successfully"}


@router.get("/issues")
def get_issues():
    db = SessionLocal()
    data = db.query(Issue).all()
    db.close()

    return data