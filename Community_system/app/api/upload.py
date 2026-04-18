from fastapi import APIRouter, UploadFile, File
from app.services.extractor import extract_data
from app.core.db import SessionLocal
from app.models.issue import Issue

router = APIRouter()

@router.post("/upload")
def upload_file(file: UploadFile = File(...)):
    data = extract_data()

    db = SessionLocal()

    new_issue = Issue(
        issue_type=data["issue_type"],
        severity=data["severity"],
        people_affected=data["people_affected"],
        location=data["location"]
    )

    db.add(new_issue)
    db.commit()
    db.close()

    return {"message": "File processed and issue created"}
@router.post("/upload")
def upload_file(file: UploadFile = File(...)):
    return {"filename": file.filename}