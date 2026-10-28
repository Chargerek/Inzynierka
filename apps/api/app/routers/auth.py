from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.passwords import hash_password, verify_password
from app.core.security import create_access_token, get_current_user, require_role
from app.db.dependencies import get_db
from app.models import DoctorProfile, PatientProfile, Sex, User, UserRole
from app.schemas.auth import (
    DoctorCreateRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserRead,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _email_in_use(db: Session, email: str) -> bool:
    return db.scalar(select(User.id).where(User.email == email)) is not None


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if _email_in_use(db, body.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Adres e-mail jest już zajęty.",
        )
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        role=UserRole.PATIENT,
        first_name=body.first_name,
        last_name=body.last_name,
        phone=body.phone,
        sex=Sex(body.sex),
        consent_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.flush()
    db.add(PatientProfile(user_id=user.id))
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy e-mail lub hasło.",
        )
    return TokenResponse(access_token=create_access_token(user))


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)):
    return user


@router.post(
    "/doctors",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)
def create_doctor(body: DoctorCreateRequest, db: Session = Depends(get_db)):
    if _email_in_use(db, body.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Adres e-mail jest już zajęty.",
        )
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        role=UserRole.DERMATOLOGIST,
        first_name=body.first_name,
        last_name=body.last_name,
        phone=body.phone,
    )
    db.add(user)
    db.flush()
    db.add(
        DoctorProfile(
            user_id=user.id,
            specialization=body.specialization,
            bio=body.bio,
        )
    )
    db.commit()
    db.refresh(user)
    return user
