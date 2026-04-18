from sqlalchemy import Column, Integer, String
from app.core.db import Base

class Issue(Base):
    __tablename__ = "issues"

    id = Column(Integer, primary_key=True, index=True)
    issue_type = Column(String)
    severity = Column(String)
    people_affected = Column(Integer)
    location = Column(String)