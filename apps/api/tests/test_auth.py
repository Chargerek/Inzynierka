from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException

from app.core.config import settings
from app.core.passwords import hash_password, verify_password
from app.core.security import get_current_user
from app.models import UserRole
from app.schemas.auth import RegisterRequest


class _StubCredentials:
    def __init__(self, token: str) -> None:
        self.credentials = token


class _StubDb:
    def __init__(self, user=None) -> None:
        self._user = user

    def scalar(self, _statement):
        return self._user


class _StubUser:
    def __init__(self, user_id: int = 1) -> None:
        self.id = user_id
        self.role = UserRole.PATIENT


def test_password_roundtrip_and_rejects_wrong_password():
    hashed = hash_password("Demo123!")
    assert hashed != "Demo123!"
    assert hashed.startswith("$2")
    assert verify_password("Demo123!", hashed) is True
    assert verify_password("inne-haslo", hashed) is False


def test_register_rejects_weak_password():
    try:
        RegisterRequest(
            email="nowy@gabinet.pl",
            password="krotkie",
            first_name="Jan",
            last_name="Kowal",
        )
    except Exception as exc:
        assert "8 znak" in str(exc)
    else:
        raise AssertionError("Słabe hasło przeszło walidację")


def test_expired_token_is_rejected():
    now = datetime.now(timezone.utc)
    expired = jwt.encode(
        {
            "sub": "1",
            "role": "patient",
            "iat": now - timedelta(hours=2),
            "exp": now - timedelta(hours=1),
        },
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    try:
        get_current_user(
            credentials=_StubCredentials(expired),
            db=_StubDb(user=_StubUser()),
        )
    except HTTPException as exc:
        assert exc.status_code == 401
    else:
        raise AssertionError("Wygasły token nie został odrzucony")
