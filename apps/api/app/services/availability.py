from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.models import (
    Appointment,
    AppointmentStatus,
    DoctorProfile,
    WorkingHours,
)

BLOCKING_STATUSES = (AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED)

SLOT_STEP_MINUTES = 15
BOOKING_HORIZON_DAYS = 60


def get_doctor(db: Session, doctor_id: int) -> DoctorProfile | None:
    return db.scalar(select(DoctorProfile).where(DoctorProfile.id == doctor_id))


def list_doctors(db: Session) -> list[DoctorProfile]:
    return list(
        db.scalars(
            select(DoctorProfile)
            .join(DoctorProfile.user)
            .order_by(DoctorProfile.id)
        )
    )


def list_appointments_in_range(
    db: Session,
    doctor_id: int,
    day: date,
) -> list[Appointment]:
    day_start = datetime.combine(day, time.min, tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)
    return list(
        db.scalars(
            select(Appointment)
            .where(
                and_(
                    Appointment.doctor_id == doctor_id,
                    Appointment.status.in_(BLOCKING_STATUSES),
                    Appointment.start_at < day_end,
                    Appointment.end_at > day_start,
                )
            )
            .order_by(Appointment.start_at)
        )
    )


def get_available_slots(
    db: Session,
    doctor: DoctorProfile,
    day: date,
    duration_minutes: int,
) -> list[tuple[datetime, datetime]]:
    weekday = day.weekday()
    working_hours = [
        wh
        for wh in db.scalars(
            select(WorkingHours).where(
                and_(
                    WorkingHours.doctor_id == doctor.id,
                    WorkingHours.weekday == weekday,
                )
            )
        )
    ]
    if not working_hours:
        return []

    busy = list_appointments_in_range(db, doctor.id, day)
    now = datetime.now(timezone.utc)
    max_start = now + timedelta(days=BOOKING_HORIZON_DAYS)
    step = timedelta(minutes=SLOT_STEP_MINUTES)
    duration = timedelta(minutes=duration_minutes)

    slots: list[tuple[datetime, datetime]] = []
    for wh in working_hours:
        window_start = datetime.combine(day, wh.start_time, tzinfo=timezone.utc)
        window_end = datetime.combine(day, wh.end_time, tzinfo=timezone.utc)
        cursor = window_start
        while cursor + duration <= window_end:
            candidate_end = cursor + duration
            if cursor >= now and cursor <= max_start and not _overlaps(cursor, candidate_end, busy):
                slots.append((cursor, candidate_end))
            cursor += step
    return slots


def is_slot_available(
    db: Session,
    doctor: DoctorProfile,
    start_at: datetime,
    duration_minutes: int,
) -> bool:
    if start_at.tzinfo is None:
        start_at = start_at.replace(tzinfo=timezone.utc)
    end_at = start_at + timedelta(minutes=duration_minutes)
    if start_at < datetime.now(timezone.utc):
        return False
    if start_at > datetime.now(timezone.utc) + timedelta(days=BOOKING_HORIZON_DAYS):
        return False

    weekday = start_at.weekday()
    working_hours = db.scalars(
        select(WorkingHours).where(
            and_(
                WorkingHours.doctor_id == doctor.id,
                WorkingHours.weekday == weekday,
            )
        )
    )
    start_time = start_at.timetz().replace(tzinfo=None)
    end_time = end_at.timetz().replace(tzinfo=None)
    within = any(
        wh.start_time <= start_time and end_time <= wh.end_time
        for wh in working_hours
    )
    if not within:
        return False

    busy = list_appointments_in_range(db, doctor.id, start_at.date())
    return not _overlaps(start_at, end_at, busy)


def has_conflict(
    db: Session,
    doctor_id: int,
    start_at: datetime,
    end_at: datetime,
    exclude_appointment_id: int | None = None,
) -> bool:
    statement = select(Appointment.id).where(
        and_(
            Appointment.doctor_id == doctor_id,
            Appointment.status.in_(BLOCKING_STATUSES),
            Appointment.start_at < end_at,
            Appointment.end_at > start_at,
        )
    )
    if exclude_appointment_id is not None:
        statement = statement.where(Appointment.id != exclude_appointment_id)
    return db.scalar(statement) is not None


def _overlaps(
    start: datetime,
    end: datetime,
    appointments: list[Appointment],
) -> bool:
    return any(
        start < appointment.end_at and end > appointment.start_at
        for appointment in appointments
    )
