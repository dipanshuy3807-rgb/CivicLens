from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String

from app.core.db import Base


class Issue(Base):
    __tablename__ = "issues"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, nullable=True, index=True)
    issue_type = Column(String, nullable=False, index=True)
    severity = Column(String, nullable=False)
    people_affected = Column(Integer, nullable=False)
    location = Column(String, nullable=False, index=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    priority_score = Column(Integer, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
