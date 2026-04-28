from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.db import engine, Base, SessionLocal
from app.models.issue import Issue
from app.models.volunteer import Volunteer
from app.api import analytics
from app.api import dashboard
from app.api import issues
from app.api import match
from app.api import upload
from app.api import volunteers
from app.services.volunteer_seed_service import seed_sample_volunteers
from sqlalchemy import text

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)
with engine.begin() as connection:
    connection.execute(text("ALTER TABLE issues ADD COLUMN IF NOT EXISTS batch_id VARCHAR"))
    connection.execute(text("CREATE INDEX IF NOT EXISTS ix_issues_batch_id ON issues (batch_id)"))

db = SessionLocal()
try:
    seed_sample_volunteers(db)
finally:
    db.close()


@app.get("/")
def home():
    return {"message": "API working"}


app.include_router(upload.router)
app.include_router(issues.router)
app.include_router(dashboard.router)
app.include_router(volunteers.router)
app.include_router(match.router)
app.include_router(analytics.router)
