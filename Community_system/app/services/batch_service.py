from sqlalchemy import func

from app.models.issue import Issue


def get_latest_batch_id(db):
    latest_batch = (
        db.query(Issue)
        .filter(Issue.batch_id.isnot(None))
        .with_entities(
            Issue.batch_id,
            func.max(Issue.created_at).label("latest_created_at"),
        )
        .group_by(Issue.batch_id)
        .order_by(func.max(Issue.created_at).desc())
        .first()
    )

    if latest_batch is not None:
        return latest_batch.batch_id

    return None
