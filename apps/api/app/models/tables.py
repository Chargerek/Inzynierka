import enum
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _enum_values(enum_cls: type[enum.Enum]) -> list[str]:
    return [item.value for item in enum_cls]


class UserRole(str, enum.Enum):
    PATIENT = "patient"
    DERMATOLOGIST = "dermatologist"
    ADMIN = "admin"


class AppointmentStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class BodySide(str, enum.Enum):
    FRONT = "front"
    BACK = "back"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", values_callable=_enum_values)
    )
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    patient_profile: Mapped["PatientProfile | None"] = relationship(back_populates="user")
    doctor_profile: Mapped["DoctorProfile | None"] = relationship(back_populates="user")


class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    birth_date: Mapped[date | None] = mapped_column(Date)

    user: Mapped[User] = relationship(back_populates="patient_profile")
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="patient")
    findings: Mapped[list["SkinFinding"]] = relationship(back_populates="patient")


class DoctorProfile(Base):
    __tablename__ = "doctor_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    specialization: Mapped[str] = mapped_column(String(120))
    bio: Mapped[str | None] = mapped_column(Text)

    user: Mapped[User] = relationship(back_populates="doctor_profile")
    working_hours: Mapped[list["WorkingHours"]] = relationship(back_populates="doctor")
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="doctor")


class WorkingHours(Base):
    __tablename__ = "working_hours"

    id: Mapped[int] = mapped_column(primary_key=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctor_profiles.id"))
    weekday: Mapped[int] = mapped_column(Integer)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)

    doctor: Mapped[DoctorProfile] = relationship(back_populates="working_hours")


class Service(Base):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    duration_minutes: Mapped[int] = mapped_column(Integer)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))

    appointments: Mapped[list["Appointment"]] = relationship(back_populates="service")


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (Index("ix_appointments_doctor_id_start_at", "doctor_id", "start_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patient_profiles.id"))
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctor_profiles.id"))
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"))
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[AppointmentStatus] = mapped_column(
        Enum(AppointmentStatus, name="appointment_status", values_callable=_enum_values),
        default=AppointmentStatus.PENDING,
    )
    notes: Mapped[str | None] = mapped_column(Text)

    patient: Mapped[PatientProfile] = relationship(back_populates="appointments")
    doctor: Mapped[DoctorProfile] = relationship(back_populates="appointments")
    service: Mapped[Service] = relationship(back_populates="appointments")
    findings: Mapped[list["SkinFinding"]] = relationship(back_populates="appointment")


class SkinFinding(Base):
    __tablename__ = "skin_findings"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patient_profiles.id"))
    appointment_id: Mapped[int | None] = mapped_column(ForeignKey("appointments.id"))
    side: Mapped[BodySide] = mapped_column(
        Enum(BodySide, name="body_side", values_callable=_enum_values)
    )
    geometry: Mapped[dict] = mapped_column(JSONB)
    color: Mapped[str] = mapped_column(String(30))
    finding_type: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    patient: Mapped[PatientProfile] = relationship(back_populates="findings")
    appointment: Mapped[Appointment | None] = relationship(back_populates="findings")
    photos: Mapped[list["FindingPhoto"]] = relationship(back_populates="finding")


class FindingPhoto(Base):
    __tablename__ = "finding_photos"

    id: Mapped[int] = mapped_column(primary_key=True)
    finding_id: Mapped[int] = mapped_column(ForeignKey("skin_findings.id"))
    path: Mapped[str] = mapped_column(String(500))
    mime: Mapped[str] = mapped_column(String(100))

    finding: Mapped[SkinFinding] = relationship(back_populates="photos")
