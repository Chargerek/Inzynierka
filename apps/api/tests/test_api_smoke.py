"""Testy dymne API — kluczowe ścieżki HTTP przez TestClient.

Działają na izolowanej bazie testowej (patrz conftest.py), więc nie ruszają
danych demo. Pokrywają: zdrowie API, rejestrację ze zgodą, pełny cykl
rezerwacji (wolny termin → konflikt → odwołanie → ponowna rezerwacja),
kontrolę dostępu (IDOR) oraz limity uploadu zdjęć.
"""

from datetime import date, datetime, time, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.passwords import hash_password
from app.models import (
    Appointment,
    AppointmentStatus,
    DoctorProfile,
    PatientProfile,
    Service,
    User,
    UserRole,
    WorkingHours,
)

DEMO_PASSWORD = "Demo123!"

JPEG_BYTES = b"\xff\xd8\xff\xe0" + b"\x00" * 64
EXE_BYTES = b"MZ\x90\x00" + b"\x00" * 100


def _next_weekday(start_from: date, weekday: int) -> date:
    delta = (weekday - start_from.weekday()) % 7
    return start_from + timedelta(days=delta or 7)


@pytest.fixture()
def clinic(db_session: Session) -> dict[str, int]:
    doctor_user = User(
        email="dr.test@gabinet.pl",
        password_hash=hash_password(DEMO_PASSWORD),
        role=UserRole.DERMATOLOGIST,
        first_name="Dorota",
        last_name="Testowa",
        consent_at=datetime.now(timezone.utc),
    )
    db_session.add(doctor_user)
    db_session.flush()
    doctor = DoctorProfile(user_id=doctor_user.id, specialization="Dermatologia")
    db_session.add(doctor)
    db_session.flush()
    for weekday in range(7):
        db_session.add(
            WorkingHours(
                doctor_id=doctor.id,
                weekday=weekday,
                start_time=time(8, 0),
                end_time=time(16, 0),
            )
        )
    service = Service(name="Konsultacja testowa", duration_minutes=30, price=100)
    db_session.add(service)
    db_session.commit()
    return {"doctor_id": doctor.id, "service_id": service.id}


def _register_patient(client: TestClient, sex: str = "female") -> tuple[str, str]:
    email = f"pacjent.{uuid4().hex[:8]}@gabinet.pl"
    response = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": DEMO_PASSWORD,
            "first_name": "Test",
            "last_name": "Pacjent",
            "sex": sex,
            "consent_accepted": True,
        },
    )
    assert response.status_code == 201, response.text
    return email, DEMO_PASSWORD


def _login(client: TestClient, email: str, password: str = DEMO_PASSWORD) -> dict[str, str]:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _patient_profile_id(db_session: Session, email: str) -> int:
    user = db_session.query(User).filter(User.email == email).one()
    return db_session.query(PatientProfile).filter(PatientProfile.user_id == user.id).one().id


def _book(
    client: TestClient,
    headers: dict[str, str],
    clinic_ids: dict[str, int],
    start_at: str,
):
    return client.post(
        "/appointments",
        headers=headers,
        json={
            "doctor_id": clinic_ids["doctor_id"],
            "service_id": clinic_ids["service_id"],
            "start_at": start_at,
        },
    )


def _first_slot(client: TestClient, clinic_ids: dict[str, int], day: date) -> str:
    response = client.get(
        "/availability",
        params={
            "doctor_id": clinic_ids["doctor_id"],
            "service_id": clinic_ids["service_id"],
            "date": day.isoformat(),
        },
    )
    assert response.status_code == 200, response.text
    slots = response.json()["slots"]
    assert slots, "Brak wolnych terminów w klinice testowej"
    return slots[0]["start"]


def test_health_ok(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_anonymous_gets_401(client: TestClient):
    assert client.get("/appointments/me").status_code == 401
    assert client.get("/reports").status_code == 401


def test_register_validation(client: TestClient):
    without_consent = client.post(
        "/auth/register",
        json={
            "email": "bez.zgody@gabinet.pl",
            "password": DEMO_PASSWORD,
            "first_name": "Bez",
            "last_name": "Zgody",
        },
    )
    assert without_consent.status_code == 422

    consent_false = client.post(
        "/auth/register",
        json={
            "email": "bez.zgody@gabinet.pl",
            "password": DEMO_PASSWORD,
            "first_name": "Bez",
            "last_name": "Zgody",
            "consent_accepted": False,
        },
    )
    assert consent_false.status_code == 422
    assert "Zgoda" in consent_false.text

    without_sex = client.post(
        "/auth/register",
        json={
            "email": "bez.plci@gabinet.pl",
            "password": DEMO_PASSWORD,
            "first_name": "Bez",
            "last_name": "Płci",
            "consent_accepted": True,
        },
    )
    assert without_sex.status_code == 422

    bad_sex = client.post(
        "/auth/register",
        json={
            "email": "zla.plec@gabinet.pl",
            "password": DEMO_PASSWORD,
            "first_name": "Zła",
            "last_name": "Płeć",
            "sex": "inne",
            "consent_accepted": True,
        },
    )
    assert bad_sex.status_code == 422


def test_register_login_me_and_duplicates(client: TestClient):
    email, password = _register_patient(client)

    duplicate = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "first_name": "Drugi",
            "last_name": "Konto",
            "sex": "male",
            "consent_accepted": True,
        },
    )
    assert duplicate.status_code == 409

    headers = _login(client, email, password)
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == email
    assert me.json()["role"] == "patient"
    assert me.json()["sex"] == "female"

    wrong_password = client.post(
        "/auth/login", json={"email": email, "password": "zle-haslo1"}
    )
    assert wrong_password.status_code == 401


def test_booking_conflict_cancel_rebook(client: TestClient, clinic: dict[str, int]):
    email, _ = _register_patient(client)
    headers = _login(client, email)

    day = _next_weekday(date.today() + timedelta(days=1), weekday=1)  # wtorek
    slot = _first_slot(client, clinic, day)

    created = _book(client, headers, clinic, slot)
    assert created.status_code == 201, created.text
    appointment_id = created.json()["id"]
    assert created.json()["status"] == "confirmed"

    conflict = _book(client, headers, clinic, slot)
    assert conflict.status_code == 409

    cancelled = client.post(f"/appointments/{appointment_id}/cancel", headers=headers)
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"

    rebooked = _book(client, headers, clinic, slot)
    assert rebooked.status_code == 201

    mine = client.get("/appointments/me", headers=headers)
    assert mine.status_code == 200
    assert len(mine.json()) == 2


def test_slot_outside_working_hours_rejected(client: TestClient, clinic: dict[str, int]):
    email, _ = _register_patient(client)
    headers = _login(client, email)

    sunday = _next_weekday(date.today(), weekday=6)
    evening = datetime.combine(sunday, time(20, 0), tzinfo=timezone.utc)
    response = _book(client, headers, clinic, evening.isoformat())
    assert response.status_code == 409


def test_patient_cannot_read_other_patients_findings(
    client: TestClient, db_session: Session
):
    email_a, _ = _register_patient(client)
    email_b, _ = _register_patient(client)
    profile_a = _patient_profile_id(db_session, email_a)

    headers_b = _login(client, email_b)
    forbidden = client.get(f"/patients/{profile_a}/findings", headers=headers_b)
    assert forbidden.status_code == 403

    headers_a = _login(client, email_a)
    own = client.get(f"/patients/{profile_a}/findings", headers=headers_a)
    assert own.status_code == 200


def test_doctor_without_appointment_gets_403(
    client: TestClient, db_session: Session, clinic: dict[str, int]
):
    email, _ = _register_patient(client)
    profile_id = _patient_profile_id(db_session, email)

    doctor_headers = _login(client, "dr.test@gabinet.pl")
    response = client.get(f"/reports?patient_id={profile_id}", headers=doctor_headers)
    assert response.status_code == 403
    assert "nie jest Twoim pacjentem" in response.text


def test_doctor_patient_list_contains_sex(
    client: TestClient, db_session: Session, clinic: dict[str, int]
):
    email, _ = _register_patient(client, sex="female")
    profile_id = _patient_profile_id(db_session, email)
    _give_doctor_appointment(db_session, clinic, profile_id)
    doctor_headers = _login(client, "dr.test@gabinet.pl")

    response = client.get("/doctor/patients", headers=doctor_headers)
    assert response.status_code == 200
    entry = next(p for p in response.json() if p["id"] == profile_id)
    assert entry["sex"] == "female"


def _give_doctor_appointment(
    db_session: Session, clinic_ids: dict[str, int], patient_profile_id: int
) -> None:
    start = datetime.now(timezone.utc) + timedelta(days=2)
    db_session.add(
        Appointment(
            patient_id=patient_profile_id,
            doctor_id=clinic_ids["doctor_id"],
            service_id=clinic_ids["service_id"],
            start_at=start,
            end_at=start + timedelta(minutes=30),
            status=AppointmentStatus.CONFIRMED,
        )
    )
    db_session.commit()


def test_upload_limits_and_content_sniffing(
    client: TestClient, db_session: Session, clinic: dict[str, int]
):
    email, _ = _register_patient(client)
    profile_id = _patient_profile_id(db_session, email)
    _give_doctor_appointment(db_session, clinic, profile_id)
    doctor_headers = _login(client, "dr.test@gabinet.pl")

    report = client.post(
        "/reports",
        headers=doctor_headers,
        json={"patient_id": profile_id, "body_figure": "female", "notes": "test"},
    )
    assert report.status_code == 201, report.text

    finding = client.post(
        "/findings",
        headers=doctor_headers,
        json={
            "report_id": report.json()["id"],
            "side": "front",
            "geometry": {"kind": "marker", "x": 200, "y": 300},
            "color": "czerwony",
            "finding_type": "plama",
        },
    )
    assert finding.status_code == 201, finding.text
    finding_id = finding.json()["id"]

    fake_image = client.post(
        f"/findings/{finding_id}/photos",
        headers=doctor_headers,
        files={"file": ("wirus.jpg", EXE_BYTES, "image/jpeg")},
    )
    assert fake_image.status_code == 415

    too_big = client.post(
        f"/findings/{finding_id}/photos",
        headers=doctor_headers,
        files={"file": ("duze.jpg", JPEG_BYTES + b"\x00" * (6 * 1024 * 1024), "image/jpeg")},
    )
    assert too_big.status_code == 413

    ok = client.post(
        f"/findings/{finding_id}/photos",
        headers=doctor_headers,
        files={"file": ("zmiana.jpg", JPEG_BYTES, "image/jpeg")},
    )
    assert ok.status_code == 201

    # sprzątanie pliku z wolumenu uploadów (rekord i tak zniknie z bazą testową)
    photo_id = ok.json()["id"]
    deleted = client.delete(
        f"/findings/{finding_id}/photos/{photo_id}", headers=doctor_headers
    )
    assert deleted.status_code == 204


def _make_admin(db_session: Session) -> str:
    user = User(
        email="admin.test@gabinet.pl",
        password_hash=hash_password(DEMO_PASSWORD),
        role=UserRole.ADMIN,
        first_name="Adam",
        last_name="Admin",
        consent_at=datetime.now(timezone.utc),
    )
    db_session.add(user)
    db_session.commit()
    return user.email


def test_admin_creates_users(client: TestClient, db_session: Session):
    _make_admin(db_session)
    admin_headers = _login(client, "admin.test@gabinet.pl")

    doctor = client.post(
        "/admin/users",
        headers=admin_headers,
        json={
            "email": "nowy.lekarz@gabinet.pl",
            "password": DEMO_PASSWORD,
            "first_name": "Nowy",
            "last_name": "Lekarz",
            "role": "dermatologist",
        },
    )
    assert doctor.status_code == 201, doctor.text
    assert doctor.json()["role"] == "dermatologist"
    # nowy lekarz może się zalogować
    _login(client, "nowy.lekarz@gabinet.pl")

    patient = client.post(
        "/admin/users",
        headers=admin_headers,
        json={
            "email": "nowy.pacjent@gabinet.pl",
            "password": DEMO_PASSWORD,
            "first_name": "Nowa",
            "last_name": "Pacjentka",
            "role": "patient",
            "sex": "female",
        },
    )
    assert patient.status_code == 201, patient.text
    assert patient.json()["role"] == "patient"

    duplicate = client.post(
        "/admin/users",
        headers=admin_headers,
        json={
            "email": "nowy.pacjent@gabinet.pl",
            "password": DEMO_PASSWORD,
            "first_name": "Drugi",
            "last_name": "Konto",
            "role": "patient",
        },
    )
    assert duplicate.status_code == 409

    # zwykły pacjent i brak logowania nie mają dostępu
    email, _ = _register_patient(client)
    patient_headers = _login(client, email)
    forbidden = client.post(
        "/admin/users",
        headers=patient_headers,
        json={
            "email": "nie.wolno@gabinet.pl",
            "password": DEMO_PASSWORD,
            "first_name": "Nie",
            "last_name": "Wolno",
            "role": "admin",
        },
    )
    assert forbidden.status_code == 403
    anonymous = client.post(
        "/admin/users",
        json={
            "email": "nie.wolno@gabinet.pl",
            "password": DEMO_PASSWORD,
            "first_name": "Nie",
            "last_name": "Wolno",
            "role": "admin",
        },
    )
    assert anonymous.status_code == 401


def test_admin_patients_list(
    client: TestClient, db_session: Session, clinic: dict[str, int]
):
    _make_admin(db_session)
    admin_headers = _login(client, "admin.test@gabinet.pl")
    email, _ = _register_patient(client, sex="female")

    response = client.get("/admin/patients", headers=admin_headers)
    assert response.status_code == 200
    entry = next(p for p in response.json() if p["email"] == email)
    assert entry["first_name"] == "Test"
    assert entry["sex"] == "female"
    assert entry["appointments_count"] == 0
    assert entry["reports_count"] == 0

    # lekarz nie ma dostępu do listy administracyjnej
    doctor_headers = _login(client, "dr.test@gabinet.pl")
    assert client.get("/admin/patients", headers=doctor_headers).status_code == 403


def test_doctor_manages_services(client: TestClient, clinic: dict[str, int]):
    doctor_headers = _login(client, "dr.test@gabinet.pl")

    created = client.post(
        "/services",
        headers=doctor_headers,
        json={"name": "Krioterapia", "duration_minutes": 15, "price": "120.00"},
    )
    assert created.status_code == 201, created.text
    service_id = created.json()["id"]

    updated = client.put(
        f"/services/{service_id}",
        headers=doctor_headers,
        json={"name": "Krioterapia", "duration_minutes": 15, "price": "150.00"},
    )
    assert updated.status_code == 200
    assert updated.json()["price"] == "150.00"

    deleted = client.delete(f"/services/{service_id}", headers=doctor_headers)
    assert deleted.status_code == 204

    # pacjent nie może grzebać w cenniku
    email, _ = _register_patient(client)
    patient_headers = _login(client, email)
    forbidden = client.post(
        "/services",
        headers=patient_headers,
        json={"name": "Nielegalna", "duration_minutes": 10, "price": "1.00"},
    )
    assert forbidden.status_code == 403
