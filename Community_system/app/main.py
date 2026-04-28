from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.db import engine, Base, SessionLocal
from app.models.issue import Issue
from app.models.user import User
from app.models.volunteer import Volunteer
from app.api import analytics
from app.api import auth
from app.api import dashboard
from app.api import issues
from app.api import match
from app.api import upload
from app.api import volunteers
from app.services.volunteer_seed_service import seed_sample_volunteers
from sqlalchemy import inspect, text

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
    existing_columns = {
        column["name"] for column in inspect(connection).get_columns("issues")
    }
    if "batch_id" not in existing_columns:
        connection.execute(text("ALTER TABLE issues ADD COLUMN batch_id VARCHAR"))
    if "assigned_volunteer" not in existing_columns:
        connection.execute(text("ALTER TABLE issues ADD COLUMN assigned_volunteer VARCHAR"))
    if "assigned_to" not in existing_columns:
        connection.execute(text("ALTER TABLE issues ADD COLUMN assigned_to INTEGER"))
    if "status" not in existing_columns:
        connection.execute(text("ALTER TABLE issues ADD COLUMN status VARCHAR NOT NULL DEFAULT 'open'"))
    connection.execute(text("CREATE INDEX IF NOT EXISTS ix_issues_batch_id ON issues (batch_id)"))
    connection.execute(text("CREATE INDEX IF NOT EXISTS ix_issues_assigned_to ON issues (assigned_to)"))
    connection.execute(text("CREATE INDEX IF NOT EXISTS ix_issues_status ON issues (status)"))

    existing_user_columns = {
        column["name"] for column in inspect(connection).get_columns("users")
    }
    if "skill" not in existing_user_columns:
        connection.execute(text("ALTER TABLE users ADD COLUMN skill VARCHAR"))
    if "location" not in existing_user_columns:
        connection.execute(text("ALTER TABLE users ADD COLUMN location VARCHAR"))
    if "availability" not in existing_user_columns:
        connection.execute(text("ALTER TABLE users ADD COLUMN availability VARCHAR"))

db = SessionLocal()
try:
    seed_sample_volunteers(db)
finally:
    db.close()


@app.get("/")
def home():
    return {"message": "API working"}


app.include_router(upload.router)
app.include_router(auth.router)
app.include_router(issues.router)
app.include_router(dashboard.router)
app.include_router(volunteers.router)
app.include_router(match.router)
app.include_router(analytics.router)
