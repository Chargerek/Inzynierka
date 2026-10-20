from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.dependencies import get_db
from app.models import DoctorProfile, Service
from app.schemas.booking import AvailabilityResponse, TimeSlot
from app.services.availability import get_available_slots

router = APIRouter(prefix="/availability", tags=["availability"])


@router.get("", response_model=AvailabilityResponse)
def get_availability(
    doctor_id: int = Query(gt=0),
    service_id: int = Query(gt=0),
    date: date = Query(),
    db: Session = Depends(get_db),
):
    doctor = db.scalar(select(DoctorProfile).where(DoctorProfile.id == doctor_id))
    if doctor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lekarz nie istnieje.",
        )
    service = db.scalar(select(Service).where(Service.id == service_id))
    if service is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usługa nie istnieje.",
        )
    slots = get_available_slots(db, doctor, date, service.duration_minutes)
    return AvailabilityResponse(
        doctor_id=doctor_id,
        date=date,
        slots=[TimeSlot(start=start, end=end) for start, end in slots],
    )
