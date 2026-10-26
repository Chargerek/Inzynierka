from datetime import date, datetime, time
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ServiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    duration_minutes: int
    price: Decimal


class ServiceUpsertRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    duration_minutes: int = Field(gt=0, le=480)
    price: Decimal = Field(gt=0, le=Decimal("99999999.99"))

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Nazwa usługi nie może być pusta.")
        return stripped


class WorkingHoursRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    weekday: int
    start_time: time
    end_time: time


class WorkingHoursEntry(BaseModel):
    weekday: int = Field(ge=0, le=6)
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def end_after_start(self) -> "WorkingHoursEntry":
        if self.end_time <= self.start_time:
            raise ValueError("Godzina końca musi być późniejsza niż początku.")
        return self


class WorkingHoursReplaceRequest(BaseModel):
    entries: list[WorkingHoursEntry] = Field(max_length=14)


class DoctorRead(BaseModel):
    id: int
    user_id: int
    first_name: str
    last_name: str
    specialization: str
    bio: str | None


class TimeSlot(BaseModel):
    start: datetime
    end: datetime


class AvailabilityResponse(BaseModel):
    doctor_id: int
    date: date
    slots: list[TimeSlot]


class AppointmentCreateRequest(BaseModel):
    doctor_id: int
    service_id: int
    start_at: datetime
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("notes")
    @classmethod
    def notes_strip(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class PatientSummary(BaseModel):
    id: int
    first_name: str
    last_name: str


class AppointmentRead(BaseModel):
    id: int
    start_at: datetime
    end_at: datetime
    status: Literal["pending", "confirmed", "cancelled", "completed"]
    notes: str | None
    service: ServiceRead
    doctor: DoctorRead | None = None
    patient: PatientSummary | None = None


class ReminderRunResult(BaseModel):
    candidates: int
    sent: int
