"""Wysyłka powiadomień e-mail (dev: Mailpit) oraz szablony wiadomości PL."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from zoneinfo import ZoneInfo

import aiosmtplib

from app.core.config import settings
from app.models import Appointment, AppointmentStatus

logger = logging.getLogger(__name__)

WARSAW_TZ = ZoneInfo("Europe/Warsaw")

WEEKDAYS_PL = [
    "poniedziałek",
    "wtorek",
    "środa",
    "czwartek",
    "piątek",
    "sobota",
    "niedziela",
]
MONTHS_PL = [
    "stycznia",
    "lutego",
    "marca",
    "kwietnia",
    "maja",
    "czerwca",
    "lipca",
    "sierpnia",
    "września",
    "października",
    "listopada",
    "grudnia",
]

REMINDER_WINDOW = timedelta(hours=24)


def format_pl(dt: datetime) -> str:
    """Polski format daty: „poniedziałek, 27 października 2026, godz. 10:00”."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    local = dt.astimezone(WARSAW_TZ)
    weekday = WEEKDAYS_PL[local.weekday()]
    month = MONTHS_PL[local.month - 1]
    return (
        f"{weekday}, {local.day} {month} {local.year}, "
        f"godz. {local:%H:%M}"
    )


def booking_confirmation(appointment: Appointment) -> tuple[str, str]:
    patient = appointment.patient.user
    doctor = appointment.doctor.user
    when = format_pl(appointment.start_at)
    subject = f"Potwierdzenie rezerwacji — {when}"
    body = (
        f"Dzień dobry {patient.first_name},\n\n"
        f"Twoja wizyta została zarezerwowana.\n\n"
        f"Usługa: {appointment.service.name}\n"
        f"Lekarz: {doctor.first_name} {doctor.last_name}\n"
        f"Termin: {when}\n\n"
        "Wizytę możesz odwołać w aplikacji najpóźniej 24 godziny przed terminem.\n\n"
        "Pozdrawiamy,\nGabinet Dermatologiczny"
    )
    return subject, body


def cancellation_notice(appointment: Appointment) -> tuple[str, str]:
    patient = appointment.patient.user
    doctor = appointment.doctor.user
    when = format_pl(appointment.start_at)
    subject = f"Odwołanie wizyty — {when}"
    body = (
        f"Dzień dobry {patient.first_name},\n\n"
        f"Twoja wizyta została odwołana.\n\n"
        f"Usługa: {appointment.service.name}\n"
        f"Lekarz: {doctor.first_name} {doctor.last_name}\n"
        f"Termin: {when}\n\n"
        "Zapraszamy do rezerwacji nowego terminu w aplikacji.\n\n"
        "Pozdrawiamy,\nGabinet Dermatologiczny"
    )
    return subject, body


def appointment_reminder(appointment: Appointment) -> tuple[str, str]:
    patient = appointment.patient.user
    doctor = appointment.doctor.user
    when = format_pl(appointment.start_at)
    subject = f"Przypomnienie o wizycie — {when}"
    body = (
        f"Dzień dobry {patient.first_name},\n\n"
        f"Przypominamy o jutrzejszej wizycie.\n\n"
        f"Usługa: {appointment.service.name}\n"
        f"Lekarz: {doctor.first_name} {doctor.last_name}\n"
        f"Termin: {when}\n\n"
        "Jeśli nie możesz przyjść, odwołaj wizytę w aplikacji.\n\n"
        "Pozdrawiamy,\nGabinet Dermatologiczny"
    )
    return subject, body


def due_for_reminder(
    appointments: list[Appointment], now: datetime
) -> list[Appointment]:
    """Wizyty potwierdzone, bez przypomnienia, startujące w ciągu 24 h."""
    return [
        appointment
        for appointment in appointments
        if appointment.status == AppointmentStatus.CONFIRMED
        and appointment.reminder_sent_at is None
        and now < appointment.start_at <= now + REMINDER_WINDOW
    ]


async def _send_async(message: EmailMessage) -> None:
    await aiosmtplib.send(
        message,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
    )


def send_email(to: str, subject: str, body: str) -> bool:
    """Wysyła e-mail. Błąd SMTP loguje i zwraca False — nie przerywa żądania."""
    message = EmailMessage()
    message["From"] = settings.mail_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    if not settings.mail_enabled:
        logger.info("mail_enabled=false — pominięto wysyłkę do %s (%s)", to, subject)
        return False
    try:
        asyncio.run(_send_async(message))
    except Exception:
        logger.exception("Nie udało się wysłać e-maila do %s", to)
        return False
    logger.info("Wysłano e-mail do %s: %s", to, subject)
    return True


def send_booking_confirmation(appointment: Appointment) -> bool:
    subject, body = booking_confirmation(appointment)
    return send_email(appointment.patient.user.email, subject, body)


def send_cancellation_notice(appointment: Appointment) -> bool:
    subject, body = cancellation_notice(appointment)
    return send_email(appointment.patient.user.email, subject, body)


def send_appointment_reminder(appointment: Appointment) -> bool:
    subject, body = appointment_reminder(appointment)
    return send_email(appointment.patient.user.email, subject, body)
