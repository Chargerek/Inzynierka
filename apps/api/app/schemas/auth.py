import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

PHONE_PATTERN = re.compile(r"^[0-9+\-\s()]{9,20}$")


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: str | None = None

    @field_validator("password")
    @classmethod
    def password_is_strong(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Hasło musi mieć co najmniej 8 znaków.")
        if not any(char.isalpha() for char in value):
            raise ValueError("Hasło musi zawierać literę.")
        if not any(char.isdigit() for char in value):
            raise ValueError("Hasło musi zawierać cyfrę.")
        return value

    @field_validator("first_name", "last_name")
    @classmethod
    def name_not_empty(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Pole nie może być puste.")
        return stripped

    @field_validator("phone")
    @classmethod
    def phone_looks_ok(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        stripped = value.strip()
        if not PHONE_PATTERN.match(stripped):
            raise ValueError("Nieprawidłowy numer telefonu.")
        return stripped


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    role: Literal["patient", "dermatologist", "admin"]
    first_name: str
    last_name: str
    phone: str | None


class AdminUserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    role: Literal["patient", "dermatologist", "admin"]
    first_name: str
    last_name: str
    phone: str | None
    created_at: datetime


class DoctorCreateRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: str | None = None
    specialization: str = "Dermatologia"
    bio: str | None = None

    @field_validator("password")
    @classmethod
    def password_is_strong(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Hasło musi mieć co najmniej 8 znaków.")
        if not any(char.isalpha() for char in value):
            raise ValueError("Hasło musi zawierać literę.")
        if not any(char.isdigit() for char in value):
            raise ValueError("Hasło musi zawierać cyfrę.")
        return value

    @field_validator("first_name", "last_name", "specialization")
    @classmethod
    def not_empty(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Pole nie może być puste.")
        return stripped
