from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from uuid import uuid4

from app.core.db import get_db
from app.services.ingestion_service import ingest_report

router = APIRouter()


@router.post("/upload")
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    file_bytes = await file.read()
    batch_id = str(uuid4())

    try:
        return ingest_report(
            db,
            file_bytes=file_bytes,
            content_type=file.content_type,
            batch_id=batch_id,
            filename=file.filename,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
