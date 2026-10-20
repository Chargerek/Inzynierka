from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_role
from app.db.dependencies import get_db
from app.models import DoctorProfile, UserRole, WorkingHours
from app.schemas.booking import (
    DoctorRead,
    WorkingHoursRead,
    WorkingHoursReplaceRequest,
)

router = APIRouter(prefix="/doctors", tags=["doctors"])


def _to_read(doctor: DoctorProfile) -> DoctorRead:
    return DoctorRead(
        id=doctor.id,
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
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)
def replace_working_hours(
    doctor_id: int,
    body: WorkingHoursReplaceRequest,
    db: Session = Depends(get_db),
):
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
