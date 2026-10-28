"""Testy zabezpieczeń: weryfikacja zawartości uploadów i zgoda rejestracyjna."""

import pytest
from pydantic import ValidationError

from app.schemas.auth import RegisterRequest
from app.services.findings import is_photo_size_allowed, sniff_image_mime

JPEG_HEADER = b"\xff\xd8\xff\xe0" + b"\x00" * 32
PNG_HEADER = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
WEBP_HEADER = b"RIFF" + b"\x24\x00\x00\x00" + b"WEBPVP8 " + b"\x00" * 16
EXE_HEADER = b"MZ\x90\x00" + b"\x00" * 60


def _register_payload(**overrides):
    payload = {
        "email": "nowy.pacjent@gabinet.pl",
        "password": "Demo123!",
        "first_name": "Nowy",
        "last_name": "Pacjent",
        "sex": "female",
        "consent_accepted": True,
    }
    payload.update(overrides)
    return payload


def test_sniff_recognizes_jpeg_png_webp():
    assert sniff_image_mime(JPEG_HEADER) == "image/jpeg"
    assert sniff_image_mime(PNG_HEADER) == "image/png"
    assert sniff_image_mime(WEBP_HEADER) == "image/webp"


def test_sniff_rejects_exe_and_other_content():
    assert sniff_image_mime(EXE_HEADER) is None
    assert sniff_image_mime(b"plain text file") is None
    assert sniff_image_mime(b"") is None
    assert sniff_image_mime(b"\xff\xd8") is None  # ucięty nagłówek JPEG


def test_sniff_distinguishes_declared_mime_mismatch():
    # Plik PNG wysłany jako image/jpeg musi zostać odrzucony (sniff != declared).
    assert sniff_image_mime(PNG_HEADER) != "image/jpeg"


def test_photo_size_limit_boundary():
    assert is_photo_size_allowed(5 * 1024 * 1024)
    assert not is_photo_size_allowed(5 * 1024 * 1024 + 1)
    assert not is_photo_size_allowed(0)


def test_register_requires_consent_flag():
    with pytest.raises(ValidationError):
        RegisterRequest(**_register_payload(consent_accepted=False))


def test_register_requires_consent_field_present():
    payload = _register_payload()
    del payload["consent_accepted"]
    with pytest.raises(ValidationError):
        RegisterRequest(**payload)


def test_register_accepts_consent_true():
    request = RegisterRequest(**_register_payload())
    assert request.consent_accepted is True


def test_register_requires_sex():
    payload = _register_payload()
    del payload["sex"]
    with pytest.raises(ValidationError):
        RegisterRequest(**payload)
    with pytest.raises(ValidationError):
        RegisterRequest(**_register_payload(sex="inne"))
