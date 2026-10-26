import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_current_user, require_role
from app.db.dependencies import get_db
from app.models import (
    Appointment,
    BodyFigure,
    BodySide,
    DoctorProfile,
    FindingPhoto,
    MedicalReport,
    PatientProfile,
    ReportPhoto,
    SkinFinding,
    User,
    UserRole,
)
from app.schemas.findings import (
    DoctorPatientRead,
    FindingPhotoRead,
    MedicalReportCreateRequest,
    MedicalReportRead,
    MedicalReportSummary,
    MedicalReportUpdateRequest,
    ReportPatientRead,
    ReportPhotoRead,
    SkinFindingCreateRequest,
    SkinFindingRead,
    SkinFindingUpdateRequest,
)
from app.services.findings import (
    extension_for_mime,
    is_photo_size_allowed,
    validate_geometry,
)

router = APIRouter(tags=["findings"])


def _to_read(finding: SkinFinding) -> SkinFindingRead:
    return SkinFindingRead(
        id=finding.id,
        patient_id=finding.patient_id,
        report_id=finding.report_id,
        appointment_id=finding.appointment_id,
        side=finding.side.value,
        geometry=finding.geometry,
        color=finding.color,
        finding_type=finding.finding_type,
        description=finding.description,
        created_at=finding.created_at,
        photos=[FindingPhotoRead(id=photo.id, mime=photo.mime) for photo in finding.photos],
    )


def _get_doctor_profile(db: Session, user: User) -> DoctorProfile:
    profile = db.scalar(select(DoctorProfile).where(DoctorProfile.user_id == user.id))
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Konto nie ma profilu lekarza.",
        )
    return profile


def _get_patient_profile_by_user(db: Session, user: User) -> PatientProfile:
    profile = db.scalar(select(PatientProfile).where(PatientProfile.user_id == user.id))
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Konto nie ma profilu pacjenta.",
        )
    return profile


def _get_patient(db: Session, patient_id: int) -> PatientProfile:
    patient = db.scalar(select(PatientProfile).where(PatientProfile.id == patient_id))
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pacjent nie istnieje.",
        )
    return patient


def _doctor_has_access_to_patient(db: Session, doctor_id: int, patient_id: int) -> bool:
    appointment = db.scalar(
        select(Appointment.id)
        .where(Appointment.doctor_id == doctor_id, Appointment.patient_id == patient_id)
        .limit(1)
    )
    return appointment is not None


def _require_patient_access(db: Session, user: User, patient_id: int) -> None:
    """Lekarz musi mieć (lub mieć mieć) wizytę z pacjentem; admin zawsze."""
    if user.role == UserRole.ADMIN:
        return
    doctor = _get_doctor_profile(db, user)
    if not _doctor_has_access_to_patient(db, doctor.id, patient_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ten pacjent nie jest Twoim pacjentem.",
        )


def _get_finding(db: Session, finding_id: int) -> SkinFinding:
    finding = db.scalar(select(SkinFinding).where(SkinFinding.id == finding_id))
    if finding is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zmiana skórna nie istnieje.",
        )
    return finding


def _get_report(db: Session, report_id: int) -> MedicalReport:
    report = db.scalar(select(MedicalReport).where(MedicalReport.id == report_id))
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Raport nie istnieje.",
        )
    return report


def _accessible_patient_ids(db: Session, user: User):
    """Podzapytanie z id pacjentów lekarza; None dla admina (wszyscy)."""
    if user.role == UserRole.ADMIN:
        return None
    doctor = _get_doctor_profile(db, user)
    return (
        select(Appointment.patient_id)
        .where(Appointment.doctor_id == doctor.id)
        .distinct()
        .scalar_subquery()
    )


def _remove_finding(db: Session, finding: SkinFinding) -> None:
    uploads_dir = Path(settings.uploads_dir)
    for photo in finding.photos:
        file_path = uploads_dir / photo.path
        if file_path.is_file():
            file_path.unlink()
        db.delete(photo)
    db.delete(finding)


def _report_summary(report: MedicalReport) -> MedicalReportSummary:
    doctor_name = None
    if report.doctor is not None:
        doctor_name = f"{report.doctor.user.first_name} {report.doctor.user.last_name}"
    return MedicalReportSummary(
        id=report.id,
        patient=ReportPatientRead(
            id=report.patient.id,
            first_name=report.patient.user.first_name,
            last_name=report.patient.user.last_name,
        ),
        doctor_name=doctor_name,
        body_figure=report.body_figure.value,
        notes=report.notes,
        findings_count=len(report.findings),
        photos_count=len(report.photos),
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


def _report_read(report: MedicalReport) -> MedicalReportRead:
    return MedicalReportRead(
        **_report_summary(report).model_dump(),
        findings=[_to_read(finding) for finding in report.findings],
        photos=[ReportPhotoRead(id=photo.id, mime=photo.mime) for photo in report.photos],
    )


def _remove_report_photo(db: Session, photo: ReportPhoto) -> None:
    file_path = Path(settings.uploads_dir) / photo.path
    if file_path.is_file():
        file_path.unlink()
    db.delete(photo)


def _get_report_photo(db: Session, report_id: int, photo_id: int) -> ReportPhoto:
    photo = db.scalar(
        select(ReportPhoto).where(
            ReportPhoto.id == photo_id,
            ReportPhoto.report_id == report_id,
        )
    )
    if photo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zdjęcie nie istnieje.",
        )
    return photo


@router.get("/doctor/patients", response_model=list[DoctorPatientRead])
def list_doctor_patients(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.DERMATOLOGIST, UserRole.ADMIN)),
):
    report_stats = (
        select(
            MedicalReport.patient_id,
            func.count(MedicalReport.id).label("reports_count"),
            func.max(MedicalReport.created_at).label("last_report_at"),
        )
        .group_by(MedicalReport.patient_id)
        .subquery()
    )
    statement = (
        select(PatientProfile, report_stats.c.reports_count, report_stats.c.last_report_at)
        .join(User, User.id == PatientProfile.user_id)
        .outerjoin(report_stats, report_stats.c.patient_id == PatientProfile.id)
        .order_by(User.last_name, User.first_name)
    )
    patient_ids = _accessible_patient_ids(db, user)
    if patient_ids is not None:
        statement = statement.where(PatientProfile.id.in_(patient_ids))
    return [
        DoctorPatientRead(
            id=patient.id,
            first_name=patient.user.first_name,
            last_name=patient.user.last_name,
            reports_count=reports_count or 0,
            last_report_at=last_report_at,
        )
        for patient, reports_count, last_report_at in db.execute(statement)
    ]


@router.get("/reports", response_model=list[MedicalReportSummary])
def list_reports(
    patient_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.DERMATOLOGIST, UserRole.ADMIN)),
):
    statement = select(MedicalReport).order_by(MedicalReport.created_at.desc())
    if patient_id is not None:
        _get_patient(db, patient_id)
        _require_patient_access(db, user, patient_id)
        statement = statement.where(MedicalReport.patient_id == patient_id)
    else:
        patient_ids = _accessible_patient_ids(db, user)
        if patient_ids is not None:
            statement = statement.where(MedicalReport.patient_id.in_(patient_ids))
    return [_report_summary(report) for report in db.scalars(statement)]


@router.post(
    "/reports",
    response_model=MedicalReportRead,
    status_code=status.HTTP_201_CREATED,
)
def create_report(
    body: MedicalReportCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.DERMATOLOGIST, UserRole.ADMIN)),
):
    _get_patient(db, body.patient_id)
    _require_patient_access(db, user, body.patient_id)

    doctor_id = None
    if user.role == UserRole.DERMATOLOGIST:
        doctor_id = _get_doctor_profile(db, user).id

    if body.body_figure is not None:
        figure = BodyFigure(body.body_figure)
    else:
        previous = db.scalar(
            select(MedicalReport.body_figure)
            .where(MedicalReport.patient_id == body.patient_id)
            .order_by(MedicalReport.created_at.desc())
            .limit(1)
        )
        figure = previous or BodyFigure.MALE

    report = MedicalReport(
        patient_id=body.patient_id,
        doctor_id=doctor_id,
        body_figure=figure,
        notes=body.notes,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return _report_read(report)


@router.get("/reports/{report_id}", response_model=MedicalReportRead)
def get_report(
    report_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.DERMATOLOGIST, UserRole.ADMIN)),
):
    report = _get_report(db, report_id)
    _require_patient_access(db, user, report.patient_id)
    return _report_read(report)


@router.put("/reports/{report_id}", response_model=MedicalReportRead)
def update_report(
    report_id: int,
    body: MedicalReportUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.DERMATOLOGIST, UserRole.ADMIN)),
):
    report = _get_report(db, report_id)
    _require_patient_access(db, user, report.patient_id)
    if body.body_figure is not None:
        report.body_figure = BodyFigure(body.body_figure)
    if body.notes is not None:
        report.notes = body.notes
    db.commit()
    db.refresh(report)
    return _report_read(report)


@router.delete("/reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(
    report_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.DERMATOLOGIST, UserRole.ADMIN)),
):
    report = _get_report(db, report_id)
    _require_patient_access(db, user, report.patient_id)
    for finding in list(report.findings):
        _remove_finding(db, finding)
    for photo in list(report.photos):
        _remove_report_photo(db, photo)
    db.delete(report)
    db.commit()


@router.post(
    "/reports/{report_id}/photos",
    response_model=ReportPhotoRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_report_photo(
    report_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.DERMATOLOGIST, UserRole.ADMIN)),
):
    report = _get_report(db, report_id)
    _require_patient_access(db, user, report.patient_id)

    extension = extension_for_mime(file.content_type)
    if extension is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Dozwolone są tylko zdjęcia JPEG, PNG lub WebP.",
        )
    data = await file.read()
    if not is_photo_size_allowed(len(data)):
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Zdjęcie może mieć maksymalnie 5 MB.",
        )

    uploads_dir = Path(settings.uploads_dir)
    uploads_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{extension}"
    (uploads_dir / filename).write_bytes(data)

    photo = ReportPhoto(
        report_id=report.id,
        path=filename,
        mime=file.content_type.lower(),
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return ReportPhotoRead(id=photo.id, mime=photo.mime)


@router.get("/reports/{report_id}/photos/{photo_id}")
def get_report_photo(
    report_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    photo = _get_report_photo(db, report_id, photo_id)
    report = _get_report(db, report_id)
    _require_patient_access(db, user, report.patient_id)
    file_path = Path(settings.uploads_dir) / photo.path
    if not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plik zdjęcia nie istnieje.",
        )
    return FileResponse(file_path, media_type=photo.mime)


@router.delete("/reports/{report_id}/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report_photo(
    report_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.DERMATOLOGIST, UserRole.ADMIN)),
):
    photo = _get_report_photo(db, report_id, photo_id)
    report = _get_report(db, report_id)
    _require_patient_access(db, user, report.patient_id)
    _remove_report_photo(db, photo)
    db.commit()


@router.get("/patients/{patient_id}/findings", response_model=list[SkinFindingRead])
def list_patient_findings(
    patient_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role == UserRole.PATIENT:
        profile = _get_patient_profile_by_user(db, user)
        if profile.id != patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Możesz przeglądać tylko własną dokumentację.",
            )
    else:
        _require_patient_access(db, user, patient_id)
    findings = db.scalars(
        select(SkinFinding)
        .where(SkinFinding.patient_id == patient_id)
        .order_by(SkinFinding.created_at.desc())
    )
    return [_to_read(finding) for finding in findings]


@router.get("/findings/me", response_model=list[SkinFindingRead])
def list_my_findings(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.PATIENT)),
):
    profile = _get_patient_profile_by_user(db, user)
    findings = db.scalars(
        select(SkinFinding)
        .where(SkinFinding.patient_id == profile.id)
        .order_by(SkinFinding.created_at.desc())
    )
    return [_to_read(finding) for finding in findings]


@router.post(
    "/findings",
    response_model=SkinFindingRead,
    status_code=status.HTTP_201_CREATED,
)
def create_finding(
    body: SkinFindingCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.DERMATOLOGIST, UserRole.ADMIN)),
):
    report = _get_report(db, body.report_id)
    _require_patient_access(db, user, report.patient_id)

    try:
        geometry = validate_geometry(body.geometry)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    finding = SkinFinding(
        patient_id=report.patient_id,
        report_id=report.id,
        side=BodySide(body.side),
        geometry=geometry,
        color=body.color,
        finding_type=body.finding_type,
        description=body.description,
    )
    db.add(finding)
    db.commit()
    db.refresh(finding)
    return _to_read(finding)


@router.put("/findings/{finding_id}", response_model=SkinFindingRead)
def update_finding(
    finding_id: int,
    body: SkinFindingUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.DERMATOLOGIST, UserRole.ADMIN)),
):
    finding = _get_finding(db, finding_id)
    _require_patient_access(db, user, finding.patient_id)

    if body.side is not None:
        finding.side = BodySide(body.side)
    if body.geometry is not None:
        try:
            finding.geometry = validate_geometry(body.geometry)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            ) from exc
    if body.color is not None:
        finding.color = body.color
    if body.finding_type is not None:
        finding.finding_type = body.finding_type
    if body.description is not None:
        finding.description = body.description

    db.commit()
    db.refresh(finding)
    return _to_read(finding)


@router.delete("/findings/{finding_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_finding(
    finding_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.DERMATOLOGIST, UserRole.ADMIN)),
):
    finding = _get_finding(db, finding_id)
    _require_patient_access(db, user, finding.patient_id)
    _remove_finding(db, finding)
    db.commit()


@router.post(
    "/findings/{finding_id}/photos",
    response_model=FindingPhotoRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_finding_photo(
    finding_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.DERMATOLOGIST, UserRole.ADMIN)),
):
    finding = _get_finding(db, finding_id)
    _require_patient_access(db, user, finding.patient_id)

    extension = extension_for_mime(file.content_type)
    if extension is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Dozwolone są tylko pliki JPG, PNG i WebP.",
        )

    data = await file.read()
    if not is_photo_size_allowed(len(data)):
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Zdjęcie może mieć maksymalnie 5 MB.",
        )

    uploads_dir = Path(settings.uploads_dir)
    uploads_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{extension}"
    (uploads_dir / filename).write_bytes(data)

    photo = FindingPhoto(
        finding_id=finding.id,
        path=filename,
        mime=file.content_type.lower(),
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return FindingPhotoRead(id=photo.id, mime=photo.mime)


@router.get("/findings/{finding_id}/photos/{photo_id}")
def get_finding_photo(
    finding_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    finding = _get_finding(db, finding_id)
    if user.role == UserRole.PATIENT:
        profile = _get_patient_profile_by_user(db, user)
        if profile.id != finding.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Możesz przeglądać tylko własną dokumentację.",
            )
    else:
        _require_patient_access(db, user, finding.patient_id)

    photo = db.scalar(
        select(FindingPhoto).where(
            FindingPhoto.id == photo_id,
            FindingPhoto.finding_id == finding.id,
        )
    )
    if photo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zdjęcie nie istnieje.",
        )
    file_path = Path(settings.uploads_dir) / photo.path
    if not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plik zdjęcia nie istnieje.",
        )
    return FileResponse(file_path, media_type=photo.mime)


@router.delete("/findings/{finding_id}/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_finding_photo(
    finding_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.DERMATOLOGIST, UserRole.ADMIN)),
):
    finding = _get_finding(db, finding_id)
    _require_patient_access(db, user, finding.patient_id)

    photo = db.scalar(
        select(FindingPhoto).where(
            FindingPhoto.id == photo_id,
            FindingPhoto.finding_id == finding.id,
        )
    )
    if photo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zdjęcie nie istnieje.",
        )
    file_path = Path(settings.uploads_dir) / photo.path
    if file_path.is_file():
        file_path.unlink()
    db.delete(photo)
    db.commit()
