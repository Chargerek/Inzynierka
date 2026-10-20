from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_role
from app.db.dependencies import get_db
from app.models import (
    Appointment,
    AppointmentStatus,
    DoctorProfile,
    PatientProfile,
    Service,
    User,
    UserRole,
)
from app.schemas.booking import (
    AppointmentCreateRequest,
    AppointmentRead,
    DoctorRead,
    PatientSummary,
    ServiceRead,
)
from app.services.availability import get_doctor, is_slot_available

CANCELLATION_NOTICE = timedelta(hours=24)

router = APIRouter(tags=["appointments"])


def _to_read(appointment: Appointment, *, include_doctor: bool = True, include_patient: bool = False) -> AppointmentRead:
    doctor = None
    if include_doctor and appointment.doctor is not None:
        doctor = DoctorRead(
            id=appointment.doctor.id,
            first_name=appointment.doctor.user.first_name,
            last_name=appointment.doctor.user.last_name,
            specialization=appointment.doctor.specialization,
            bio=appointment.doctor.bio,
        )
    patient = None
    if include_patient and appointment.patient is not None:
        patient = PatientSummary(
            id=appointment.patient.id,
            first_name=appointment.patient.user.first_name,
            last_name=appointment.patient.user.last_name,
        )
    return AppointmentRead(
        id=appointment.id,
        start_at=appointment.start_at,
        end_at=appointment.end_at,
        status=appointment.status,
        notes=appointment.notes,
        service=ServiceRead.model_validate(appointment.service),
        doctor=doctor,
        patient=patient,
    )


def _get_patient_profile(db: Session, user: User) -> PatientProfile:
    profile = db.scalar(select(PatientProfile).where(PatientProfile.user_id == user.id))
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Konto nie ma profilu pacjenta.",
        )
    return profile


def _get_doctor_profile(db: Session, user: User) -> DoctorProfile:
    profile = db.scalar(select(DoctorProfile).where(DoctorProfile.user_id == user.id))
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Konto nie ma profilu lekarza.",
        )
    return profile


@router.post(
    "/appointments",
    response_model=AppointmentRead,
    status_code=status.HTTP_201_CREATED,
)
def create_appointment(
    body: AppointmentCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.PATIENT)),
):
    patient = _get_patient_profile(db, user)
    doctor = get_doctor(db, body.doctor_id)
    if doctor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lekarz nie istnieje.",
        )
    service = db.scalar(select(Service).where(Service.id == body.service_id))
    if service is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usługa nie istnieje.",
        )
    start_at = body.start_at
    if start_at.tzinfo is None:
        start_at = start_at.replace(tzinfo=timezone.utc)

    if not is_slot_available(db, doctor, start_at, service.duration_minutes):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Wybrany termin nie jest dostępny.",
        )

    appointment = Appointment(
        patient_id=patient.id,
        doctor_id=doctor.id,
        service_id=service.id,
        start_at=start_at,
        end_at=start_at + timedelta(minutes=service.duration_minutes),
        status=AppointmentStatus.CONFIRMED,
        notes=body.notes,
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return _to_read(appointment)


@router.get("/appointments/me", response_model=list[AppointmentRead])
def list_my_appointments(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role == UserRole.PATIENT:
        profile = _get_patient_profile(db, user)
        appointments = db.scalars(
            select(Appointment)
            .where(Appointment.patient_id == profile.id)
            .order_by(Appointment.start_at.desc())
        )
        return [_to_read(appointment) for appointment in appointments]
    if user.role == UserRole.DERMATOLOGIST:
        profile = _get_doctor_profile(db, user)
        appointments = db.scalars(
            select(Appointment)
            .where(Appointment.doctor_id == profile.id)
            .order_by(Appointment.start_at.desc())
        )
        return [
            _to_read(appointment, include_doctor=False, include_patient=True)
            for appointment in appointments
        ]
    appointments = db.scalars(select(Appointment).order_by(Appointment.start_at.desc()))
    return [
        _to_read(appointment, include_doctor=True, include_patient=True)
        for appointment in appointments
    ]


@router.get("/doctor/appointments", response_model=list[AppointmentRead])
def list_doctor_appointments(
    from_: datetime = Query(alias="from"),
    to: datetime = Query(),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.DERMATOLOGIST, UserRole.ADMIN)),
):
    if to < from_:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Data końca nie może być wcześniejsza niż początku.",
        )
    if user.role == UserRole.DERMATOLOGIST:
        doctor = _get_doctor_profile(db, user)
        doctor_id = doctor.id
    else:
        doctor_id = None
    statement = (
        select(Appointment)
        .where(
            Appointment.start_at < to,
            Appointment.end_at > from_,
        )
        .order_by(Appointment.start_at)
    )
    if doctor_id is not None:
        statement = statement.where(Appointment.doctor_id == doctor_id)
    appointments = db.scalars(statement)
    return [
        _to_read(appointment, include_doctor=False, include_patient=True)
        for appointment in appointments
    ]


@router.post("/appointments/{appointment_id}/cancel", response_model=AppointmentRead)
def cancel_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    appointment = db.scalar(select(Appointment).where(Appointment.id == appointment_id))
    if appointment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wizyta nie istnieje.",
        )

    if user.role == UserRole.PATIENT:
        patient = _get_patient_profile(db, user)
        if appointment.patient_id != patient.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Nie możesz odwołać cudzej wizyty.",
            )
    elif user.role == UserRole.DERMATOLOGIST:
        doctor = _get_doctor_profile(db, user)
        if appointment.doctor_id != doctor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Nie możesz odwołać wizyty innego lekarza.",
            )

    if appointment.status in (AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tej wizyty nie można już odwołać.",
        )

    if user.role == UserRole.PATIENT:
        start_at = appointment.start_at
        if start_at.tzinfo is None:
            start_at = start_at.replace(tzinfo=timezone.utc)
        if start_at - datetime.now(timezone.utc) < CANCELLATION_NOTICE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Wizytę można odwołać najpóźniej 24 godziny przed terminem.",
            )

    appointment.status = AppointmentStatus.CANCELLED
    db.commit()
    db.refresh(appointment)
    return _to_read(
        appointment,
        include_patient=user.role != UserRole.PATIENT,
    )
