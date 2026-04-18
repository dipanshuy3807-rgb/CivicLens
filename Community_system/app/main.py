from fastapi import FastAPI
from app.core.db import engine, Base
from app.models.issue import Issue
from app.api import issues
from app.api import upload
app = FastAPI()
Base.metadata.create_all(bind=engine)
@app.get("/")
def home():
    return {"message": "API working"}

app.include_router(upload.router)
app.include_router(issues.router)