from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.core.auth import create_access_token, get_current_user, hash_password, require_role, verify_password
from app.core.db import get_db
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


class SignupRequest(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=6)
    role: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class VolunteerOnboardingRequest(BaseModel):
    skill: str = Field(min_length=1)
    location: str = Field(min_length=1)
    availability: str = Field(min_length=1)


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    role = payload.role.strip().lower()
    if role not in {"ngo", "volunteer"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be ngo or volunteer",
        )

    existing_user = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing_user is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists")

    user = User(
        name=payload.name.strip(),
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return _auth_response(user)


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    return _auth_response(user)


@router.get("/volunteers")
def get_volunteer_users(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("ngo")),
):
    volunteers = (
        db.query(User)
        .filter(User.role == "volunteer")
        .order_by(User.created_at.desc())
        .all()
    )
    return [_serialize_user(volunteer) for volunteer in volunteers]


@router.put("/me/volunteer-profile")
def update_volunteer_profile(
    payload: VolunteerOnboardingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("volunteer")),
):
    availability = payload.availability.strip().lower()
    if availability not in {"full-time", "part-time", "weekends"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Availability must be full-time, part-time, or weekends",
        )

    current_user.skill = payload.skill.strip().lower()
    current_user.location = payload.location.strip()
    current_user.availability = availability
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return {"user": _serialize_user(current_user)}


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {"user": _serialize_user(current_user)}


def _auth_response(user: User) -> dict:
    return {
        "token": create_access_token(user),
        "role": user.role,
        "user": _serialize_user(user),
    }


def _serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "skill": user.skill,
        "location": user.location,
        "availability": user.availability,
        "onboarding_completed": _has_completed_onboarding(user),
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def _has_completed_onboarding(user: User) -> bool:
    if user.role != "volunteer":
        return True
    return bool(user.skill and user.location and user.availability)
