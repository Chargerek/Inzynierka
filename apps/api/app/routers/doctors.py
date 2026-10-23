from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.dependencies import get_db
from app.models import DoctorProfile, User, UserRole, WorkingHours
from app.schemas.booking import (
    DoctorRead,
    WorkingHoursRead,
    WorkingHoursReplaceRequest,
)

router = APIRouter(prefix="/doctors", tags=["doctors"])


def _to_read(doctor: DoctorProfile) -> DoctorRead:
    return DoctorRead(
        id=doctor.id,
        user_id=doctor.user_id,
        first_name=doctor.user.first_name,
        last_name=doctor.user.last_name,
        specialization=doctor.specialization,
        bio=doctor.bio,
    )


@router.get("", response_model=list[DoctorRead])
def list_doctors(db: Session = Depends(get_db)):
    doctors = list(db.scalars(select(DoctorProfile).order_by(DoctorProfile.id)))
    return [_to_read(doctor) for doctor in doctors]


@router.get("/{doctor_id}/working-hours", response_model=list[WorkingHoursRead])
def get_working_hours(doctor_id: int, db: Session = Depends(get_db)):
    doctor = db.scalar(select(DoctorProfile).where(DoctorProfile.id == doctor_id))
    if doctor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lekarz nie istnieje.",
        )
    return list(
        db.scalars(
            select(WorkingHours)
            .where(WorkingHours.doctor_id == doctor_id)
            .order_by(WorkingHours.weekday, WorkingHours.start_time)
        )
    )


@router.put(
    "/{doctor_id}/working-hours",
    response_model=list[WorkingHoursRead],
)
def replace_working_hours(
    doctor_id: int,
    body: WorkingHoursReplaceRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role == UserRole.DERMATOLOGIST:
        own_profile = db.scalar(
            select(DoctorProfile).where(DoctorProfile.user_id == user.id)
        )
        if own_profile is None or own_profile.id != doctor_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Możesz edytować tylko własne godziny pracy.",
            )
    elif user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Brak uprawnień.",
        )
    doctor = db.scalar(select(DoctorProfile).where(DoctorProfile.id == doctor_id))
    if doctor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lekarz nie istnieje.",
        )
    for existing in db.scalars(
        select(WorkingHours).where(WorkingHours.doctor_id == doctor_id)
    ):
        db.delete(existing)
    for entry in body.entries:
        db.add(
            WorkingHours(
                doctor_id=doctor_id,
                weekday=entry.weekday,
                start_time=entry.start_time,
                end_time=entry.end_time,
            )
        )
    db.commit()
    return list(
        db.scalars(
            select(WorkingHours)
            .where(WorkingHours.doctor_id == doctor_id)
            .order_by(WorkingHours.weekday, WorkingHours.start_time)
        )
    )
