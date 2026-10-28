from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.passwords import hash_password
from app.core.security import require_role
from app.db.dependencies import get_db
from app.models import (
    Appointment,
    DoctorProfile,
    MedicalReport,
    PatientProfile,
    Sex,
    User,
    UserRole,
)
from app.schemas.auth import AdminPatientRead, AdminUserCreateRequest, AdminUserRead

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get(
    "/users",
    response_model=list[AdminUserRead],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)
def list_users(db: Session = Depends(get_db)):
    return list(db.scalars(select(User).order_by(User.id)))


@router.post(
    "/users",
    response_model=AdminUserRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)
def create_user(body: AdminUserCreateRequest, db: Session = Depends(get_db)):
    if db.scalar(select(User.id).where(User.email == body.email)) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Adres e-mail jest już zajęty.",
        )
    role = UserRole(body.role)
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        role=role,
        first_name=body.first_name,
        last_name=body.last_name,
        phone=body.phone,
        sex=Sex(body.sex) if body.sex else None,
        # Konto zakłada administrator — datę zgody odnotowujemy jak przy rejestracji.
        consent_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.flush()
    if role == UserRole.PATIENT:
        db.add(PatientProfile(user_id=user.id))
    elif role == UserRole.DERMATOLOGIST:
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


@router.get(
    "/patients",
    response_model=list[AdminPatientRead],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)
def list_patients(db: Session = Depends(get_db)):
    appointments_stats = (
        select(
            Appointment.patient_id,
            func.count(Appointment.id).label("appointments_count"),
        )
        .group_by(Appointment.patient_id)
        .subquery()
    )
    reports_stats = (
        select(
            MedicalReport.patient_id,
            func.count(MedicalReport.id).label("reports_count"),
        )
        .group_by(MedicalReport.patient_id)
        .subquery()
    )
    statement = (
        select(
            PatientProfile,
            appointments_stats.c.appointments_count,
            reports_stats.c.reports_count,
        )
        .join(User, User.id == PatientProfile.user_id)
        .outerjoin(
            appointments_stats,
            appointments_stats.c.patient_id == PatientProfile.id,
        )
        .outerjoin(
            reports_stats,
            reports_stats.c.patient_id == PatientProfile.id,
        )
        .order_by(User.last_name, User.first_name)
    )
    return [
        AdminPatientRead(
            id=patient.id,
            user_id=patient.user_id,
            first_name=patient.user.first_name,
            last_name=patient.user.last_name,
            email=patient.user.email,
            phone=patient.user.phone,
            sex=patient.user.sex.value if patient.user.sex else None,
            birth_date=patient.birth_date,
            created_at=patient.user.created_at,
            appointments_count=appointments_count or 0,
            reports_count=reports_count or 0,
        )
        for patient, appointments_count, reports_count in db.execute(statement)
    ]
