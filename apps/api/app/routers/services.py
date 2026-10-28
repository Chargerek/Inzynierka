from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_role
from app.db.dependencies import get_db
from app.models import Appointment, AppointmentStatus, Service, UserRole
from app.schemas.booking import ServiceRead, ServiceUpsertRequest

router = APIRouter(prefix="/services", tags=["services"])


@router.get("", response_model=list[ServiceRead])
def list_services(db: Session = Depends(get_db)):
    return list(db.scalars(select(Service).order_by(Service.name)))


@router.post(
    "",
    response_model=ServiceRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(UserRole.ADMIN, UserRole.DERMATOLOGIST))],
)
def create_service(body: ServiceUpsertRequest, db: Session = Depends(get_db)):
    service = Service(
        name=body.name,
        duration_minutes=body.duration_minutes,
        price=body.price,
    )
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


@router.put(
    "/{service_id}",
    response_model=ServiceRead,
    dependencies=[Depends(require_role(UserRole.ADMIN, UserRole.DERMATOLOGIST))],
)
def update_service(
    service_id: int,
    body: ServiceUpsertRequest,
    db: Session = Depends(get_db),
):
    service = db.scalar(select(Service).where(Service.id == service_id))
    if service is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usługa nie istnieje.",
        )
    service.name = body.name
    service.duration_minutes = body.duration_minutes
    service.price = body.price
    db.commit()
    db.refresh(service)
    return service


@router.delete(
    "/{service_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_role(UserRole.ADMIN, UserRole.DERMATOLOGIST))],
)
def delete_service(service_id: int, db: Session = Depends(get_db)):
    service = db.scalar(select(Service).where(Service.id == service_id))
    if service is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usługa nie istnieje.",
        )
    future_appointments = db.scalar(
        select(Appointment.id).where(
            Appointment.service_id == service_id,
            Appointment.status.in_(
                (AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED)
            ),
        )
    )
    if future_appointments is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Nie można usunąć usługi, do której są przypisane wizyty.",
        )
    db.delete(service)
    db.commit()
