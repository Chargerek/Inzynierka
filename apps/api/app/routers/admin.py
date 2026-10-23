from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_role
from app.db.dependencies import get_db
from app.models import User, UserRole
from app.schemas.auth import AdminUserRead

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get(
    "/users",
    response_model=list[AdminUserRead],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)
def list_users(db: Session = Depends(get_db)):
    return list(db.scalars(select(User).order_by(User.id)))
