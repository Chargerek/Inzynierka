from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class FindingPhotoRead(BaseModel):
    id: int
    mime: str


class SkinFindingRead(BaseModel):
    id: int
    patient_id: int
    report_id: int | None
    appointment_id: int | None
    side: str
    geometry: dict[str, Any]
    color: str
    finding_type: str
    description: str
    created_at: datetime
    photos: list[FindingPhotoRead]


class SkinFindingCreateRequest(BaseModel):
    report_id: int
    side: Literal["front", "back"]
    geometry: dict[str, Any]
    color: str = Field(min_length=1, max_length=30)
    finding_type: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=2000)


class SkinFindingUpdateRequest(BaseModel):
    side: Literal["front", "back"] | None = None
    geometry: dict[str, Any] | None = None
    color: str | None = Field(default=None, min_length=1, max_length=30)
    finding_type: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=2000)


class DoctorPatientRead(BaseModel):
    id: int
    first_name: str
    last_name: str
    reports_count: int = 0
    last_report_at: datetime | None = None


class ReportPatientRead(BaseModel):
    id: int
    first_name: str
    last_name: str


class ReportPhotoRead(BaseModel):
    id: int
    mime: str


class MedicalReportSummary(BaseModel):
    id: int
    patient: ReportPatientRead
    doctor_name: str | None
    body_figure: Literal["male", "female"]
    notes: str
    findings_count: int
    photos_count: int = 0
    created_at: datetime
    updated_at: datetime


class MedicalReportRead(MedicalReportSummary):
    findings: list[SkinFindingRead]
    photos: list[ReportPhotoRead] = []


class MedicalReportCreateRequest(BaseModel):
    patient_id: int
    body_figure: Literal["male", "female"] | None = None
    notes: str = Field(default="", max_length=10000)


class MedicalReportUpdateRequest(BaseModel):
    body_figure: Literal["male", "female"] | None = None
    notes: str | None = Field(default=None, max_length=10000)
