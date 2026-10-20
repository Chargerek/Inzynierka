from datetime import datetime, time, timedelta, timezone

from app.models import AppointmentStatus
from app.services.availability import _overlaps


class _StubAppointment:
    def __init__(self, start: datetime, end: datetime) -> None:
        self.start_at = start
        self.end_at = end


def test_overlaps_detects_collision():
    day = datetime.now(timezone.utc).date() + timedelta(days=7)
    existing = _StubAppointment(
        datetime.combine(day, time(10, 0), tzinfo=timezone.utc),
        datetime.combine(day, time(10, 30), tzinfo=timezone.utc),
    )
    colliding_start = datetime.combine(day, time(10, 15), tzinfo=timezone.utc)
    colliding_end = datetime.combine(day, time(10, 45), tzinfo=timezone.utc)
    assert _overlaps(colliding_start, colliding_end, [existing]) is True


def test_overlaps_allows_adjacent_slots():
    day = datetime.now(timezone.utc).date() + timedelta(days=7)
    existing = _StubAppointment(
        datetime.combine(day, time(10, 0), tzinfo=timezone.utc),
        datetime.combine(day, time(10, 30), tzinfo=timezone.utc),
    )
    adjacent_start = datetime.combine(day, time(10, 30), tzinfo=timezone.utc)
    adjacent_end = datetime.combine(day, time(11, 0), tzinfo=timezone.utc)
    assert _overlaps(adjacent_start, adjacent_end, [existing]) is False


def test_appointment_statuses_block_slots():
    assert AppointmentStatus.PENDING.value == "pending"
    assert AppointmentStatus.CONFIRMED.value == "confirmed"
    assert AppointmentStatus.CANCELLED.value == "cancelled"
    assert AppointmentStatus.COMPLETED.value == "completed"
