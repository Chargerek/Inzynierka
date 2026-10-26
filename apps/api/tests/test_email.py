from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.core.config import settings
from app.models import AppointmentStatus
from app.services.email import (
    appointment_reminder,
    booking_confirmation,
    cancellation_notice,
    due_for_reminder,
    format_pl,
    send_email,
)


def _stub_appointment(
    start_at: datetime,
    status: AppointmentStatus = AppointmentStatus.CONFIRMED,
    reminder_sent_at: datetime | None = None,
):
    return SimpleNamespace(
        patient=SimpleNamespace(
            user=SimpleNamespace(
                first_name="Jan", last_name="Nowak", email="jan.nowak@gabinet.pl"
            )
        ),
        doctor=SimpleNamespace(
            user=SimpleNamespace(first_name="Anna", last_name="Kowalska")
        ),
        service=SimpleNamespace(name="Konsultacja dermatologiczna"),
        start_at=start_at,
        status=status,
        reminder_sent_at=reminder_sent_at,
    )


def test_format_pl_polish_names_and_warsaw_time():
    # 09:00 UTC = 10:00 w Warszawie (CET, koniec DST 25.10.2026)
    dt = datetime(2026, 10, 27, 9, 0, tzinfo=timezone.utc)
    assert format_pl(dt) == "wtorek, 27 października 2026, godz. 10:00"


def test_format_pl_naive_treated_as_utc():
    dt = datetime(2026, 10, 26, 9, 30)
    assert format_pl(dt) == "poniedziałek, 26 października 2026, godz. 10:30"


def test_booking_confirmation_content():
    appointment = _stub_appointment(datetime(2026, 10, 27, 9, 0, tzinfo=timezone.utc))
    subject, body = booking_confirmation(appointment)
    assert "Potwierdzenie rezerwacji" in subject
    assert "27 października 2026" in subject
    assert "Jan" in body
    assert "Anna Kowalska" in body
    assert "Konsultacja dermatologiczna" in body
    assert "godz. 10:00" in body


def test_cancellation_notice_content():
    appointment = _stub_appointment(datetime(2026, 10, 27, 9, 0, tzinfo=timezone.utc))
    subject, body = cancellation_notice(appointment)
    assert "Odwołanie wizyty" in subject
    assert "odwołana" in body
    assert "27 października 2026" in body


def test_appointment_reminder_content():
    appointment = _stub_appointment(datetime(2026, 10, 27, 9, 0, tzinfo=timezone.utc))
    subject, body = appointment_reminder(appointment)
    assert "Przypomnienie" in subject
    assert "jutrzejszej wizycie" in body
    assert "Anna Kowalska" in body


def test_due_for_reminder_filters():
    now = datetime.now(timezone.utc)
    soon = _stub_appointment(now + timedelta(hours=20))
    too_late = _stub_appointment(now + timedelta(hours=30))
    already_sent = _stub_appointment(now + timedelta(hours=20), reminder_sent_at=now)
    cancelled = _stub_appointment(
        now + timedelta(hours=20), status=AppointmentStatus.CANCELLED
    )
    past = _stub_appointment(now - timedelta(hours=1))

    due = due_for_reminder([soon, too_late, already_sent, cancelled, past], now)

    assert due == [soon]


def test_send_email_disabled_returns_false(monkeypatch):
    monkeypatch.setattr(settings, "mail_enabled", False)
    assert send_email("jan.nowak@gabinet.pl", "Temat", "Treść") is False
