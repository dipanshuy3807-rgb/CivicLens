from sqlalchemy.orm import Session

from app.models.issue import Issue
from app.services.geocoding_service import geocode_location
from app.services.nlp_service import extract_issue_records
from app.services.ocr_service import extract_text
from app.services.priority_service import calculate_priority


def ingest_report(
    db: Session,
    *,
    file_bytes: bytes,
    content_type: str | None,
    batch_id: str,
    filename: str | None = None,
) -> dict:
    raw_text = extract_text(file_bytes, content_type)
    extracted_records = extract_issue_records(raw_text)

    if not extracted_records:
        raise ValueError("No issue data could be extracted from the uploaded file.")

    created_issues = []
    duplicates = []
    pending_issues = []
    seen_records = []

    for record in extracted_records:
        normalized_record = _normalize_issue_record(record)
        if _is_batch_duplicate(seen_records, normalized_record):
            duplicates.append(normalized_record)
            continue

        latitude, longitude = geocode_location(normalized_record["location"])
        issue = Issue(
            batch_id=batch_id,
            issue_type=normalized_record["issue_type"],
            severity=normalized_record["severity"],
            people_affected=normalized_record["people_affected"],
            location=normalized_record["location"],
            latitude=latitude,
            longitude=longitude,
            priority_score=calculate_priority(
                normalized_record["severity"],
                normalized_record["people_affected"],
            ),
        )
        pending_issues.append(issue)
        seen_records.append(normalized_record)

    if pending_issues:
        db.add_all(pending_issues)
        db.commit()
        for issue in pending_issues:
            db.refresh(issue)
            created_issues.append(_serialize_issue(issue))
    else:
        db.rollback()

    return {
        "message": "uploaded" if created_issues else _build_message(created_issues, duplicates),
        "batch_id": batch_id,
        "filename": filename,
        "total_extracted": len(extracted_records),
        "created_count": len(created_issues),
        "duplicate_count": len(duplicates),
        "issue": created_issues[0] if created_issues else None,
        "created_issues": created_issues,
        "duplicate_issues": duplicates,
        "extracted_text": raw_text,
    }


def _normalize_issue_record(record: dict) -> dict:
    location = (record.get("location") or "Unknown").strip() or "Unknown"

    return {
        "issue_type": record.get("issue_type") or "General Issue",
        "severity": record.get("severity") or "Low",
        "people_affected": max(int(record.get("people_affected") or 0), 0),
        "location": location,
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


def _build_message(created_issues: list[dict], duplicates: list[dict]) -> str:
    if created_issues and duplicates:
        return "File processed with some duplicates skipped"
    if created_issues:
        return "File processed successfully"
    return "All extracted issues were duplicates"


def _is_batch_duplicate(seen_records: list[dict], candidate: dict) -> bool:
    for seen_record in seen_records:
        if seen_record["issue_type"] != candidate["issue_type"]:
            continue
        if seen_record["location"].lower() != candidate["location"].lower():
            continue
        baseline = max(seen_record["people_affected"], candidate["people_affected"], 1)
        difference_ratio = abs(seen_record["people_affected"] - candidate["people_affected"]) / baseline
        if difference_ratio < 0.2:
            return True

    return False
