"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth, useAuthorizedFetch } from "@/features/auth/auth-context";
import { RoleGuard } from "@/features/auth/role-guard";
import { ApiError, apiFetch } from "@/lib/api";
import {
  WEEKDAY_NAMES,
  addDays,
  formatTime,
  startOfWeek,
  toLocalDateString,
} from "@/lib/format";
import type {
  Appointment,
  Doctor,
  WorkingHours,
  WorkingHoursEntry,
} from "@/lib/types";

const STATUS_LABELS: Record<Appointment["status"], string> = {
  pending: "Oczekująca",
  confirmed: "Potwierdzona",
  cancelled: "Odwołana",
  completed: "Zrealizowana",
};

const STATUS_CLASSES: Record<Appointment["status"], string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-violet-100 text-violet-800",
  cancelled: "bg-red-100 text-red-700",
  completed: "bg-zinc-100 text-zinc-600",
};

type WeekdayEditor = {
  enabled: boolean;
  start_time: string;
  end_time: string;
};

export default function DoctorPanelPage() {
  return (
    <RoleGuard roles={["dermatologist"]}>
      <DoctorPanel />
    </RoleGuard>
  );
}

function DoctorPanel() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"kalendarz" | "dostepnosc">("kalendarz");
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Doctor[]>("/doctors")
      .then((doctors) => {
        const own = doctors.find((item) => item.user_id === user?.id) ?? null;
        setDoctor(own);
        if (!own) {
          setError("Nie znaleziono profilu lekarza dla tego konta.");
        }
      })
      .catch(() => setError("Nie udało się pobrać profilu lekarza."));
  }, [user?.id]);

  return (
    <div className="flex flex-1 flex-col">
      <section className="bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 px-4 py-16 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
            Panel lekarza
          </h1>
          <p className="max-w-xl text-base leading-7 text-zinc-600">
            Witaj, {user?.first_name} {user?.last_name}. Twój kalendarz i
            dostępność.
          </p>
          <div className="mt-2 flex gap-1 rounded-lg bg-zinc-100 p-1 text-sm font-medium">
            {(
              [
                { id: "kalendarz", label: "Kalendarz" },
                { id: "dostepnosc", label: "Dostępność" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded-md px-4 py-2 transition-colors ${
                  tab === item.id
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-16">
        {error ? (
          <p className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {tab === "kalendarz" ? (
          <DoctorCalendar />
        ) : (
          <AvailabilityEditor doctor={doctor} />
        )}
      </section>
    </div>
  );
}

function DoctorCalendar() {
  const authorizedFetch = useAuthorizedFetch();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const weekEnd = addDays(weekStart, 7);

  useEffect(() => {
    let active = true;
    const from = weekStart.toISOString();
    const to = weekEnd.toISOString();
    authorizedFetch<Appointment[]>(
      `/doctor/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    )
      .then((data) => {
        if (active) {
          setAppointments(data);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Nie udało się pobrać kalendarza.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [weekStart, weekEnd, authorizedFetch]);

  const goToWeek = (offset: number) => {
    setAppointments(null);
    setError(null);
    setWeekStart((current) => addDays(current, offset));
  };

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appointment of appointments ?? []) {
      const key = toLocalDateString(new Date(appointment.start_at));
      const list = map.get(key) ?? [];
      list.push(appointment);
      map.set(key, list);
    }
    return map;
  }, [appointments]);

  const weekLabel = `${weekStart.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
  })} – ${addDays(weekStart, 6).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}`;

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => goToWeek(-7)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
        >
          ← Poprzedni
        </button>
        <h2 className="text-lg font-semibold capitalize text-zinc-900">
          {weekLabel}
        </h2>
        <button
          type="button"
          onClick={() => goToWeek(7)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
        >
          Następny →
        </button>
      </div>

      {error ? (
        <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {appointments === null ? (
        <p className="mt-8 text-sm text-zinc-500">Ładowanie kalendarza…</p>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {days.map((day) => {
            const key = toLocalDateString(day);
            const dayAppointments = byDay.get(key) ?? [];
            const isToday = key === toLocalDateString(new Date());
            return (
              <div
                key={key}
                className={`rounded-lg border bg-white p-5 ${
                  isToday ? "border-violet-400" : "border-zinc-200"
                }`}
              >
                <p className="text-sm font-semibold capitalize text-zinc-900">
                  {day.toLocaleDateString("pl-PL", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                  {isToday ? (
                    <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
                      dziś
                    </span>
                  ) : null}
                </p>
                {dayAppointments.length === 0 ? (
                  <p className="mt-3 text-sm text-zinc-400">Brak wizyt</p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-2">
                    {dayAppointments.map((appointment) => (
                      <li
                        key={appointment.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-zinc-900">
                            {formatTime(appointment.start_at)}–
                            {formatTime(appointment.end_at)}{" "}
                            {appointment.patient
                              ? `· ${appointment.patient.first_name} ${appointment.patient.last_name}`
                              : ""}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {appointment.service.name}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[appointment.status]}`}
                        >
                          {STATUS_LABELS[appointment.status]}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AvailabilityEditor({ doctor }: { doctor: Doctor | null }) {
  const authorizedFetch = useAuthorizedFetch();
  const [weekdays, setWeekdays] = useState<WeekdayEditor[]>(
    WEEKDAY_NAMES.map(() => ({
      enabled: false,
      start_time: "09:00",
      end_time: "17:00",
    })),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!doctor) {
      return;
    }
    apiFetch<WorkingHours[]>(`/doctors/${doctor.id}/working-hours`)
      .then((hours) => {
        setWeekdays(
          WEEKDAY_NAMES.map((_, weekday) => {
            const existing = hours.find((item) => item.weekday === weekday);
            return existing
              ? {
                  enabled: true,
                  start_time: existing.start_time.slice(0, 5),
                  end_time: existing.end_time.slice(0, 5),
                }
              : { enabled: false, start_time: "09:00", end_time: "17:00" };
          }),
        );
      })
      .catch(() => setError("Nie udało się pobrać godzin pracy."))
      .finally(() => setLoading(false));
  }, [doctor]);

  const updateWeekday = (
    weekday: number,
    patch: Partial<WeekdayEditor>,
  ) => {
    setWeekdays((current) =>
      current.map((item, index) =>
        index === weekday ? { ...item, ...patch } : item,
      ),
    );
  };

  const handleSave = async () => {
    if (!doctor) {
      return;
    }
    setMessage(null);
    setError(null);

    const entries: WorkingHoursEntry[] = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const item = weekdays[weekday];
      if (!item.enabled) {
        continue;
      }
      if (item.end_time <= item.start_time) {
        setError(
          `${WEEKDAY_NAMES[weekday]}: godzina końca musi być późniejsza niż początku.`,
        );
        return;
      }
      entries.push({
        weekday,
        start_time: item.start_time,
        end_time: item.end_time,
      });
    }

    setSaving(true);
    try {
      await authorizedFetch(`/doctors/${doctor.id}/working-hours`, {
        method: "PUT",
        body: { entries },
      });
      setMessage("Godziny pracy zostały zapisane.");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Nie udało się zapisać godzin pracy.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!doctor) {
    return null;
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Ładowanie godzin pracy…</p>;
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6">
      <h2 className="text-xl font-semibold text-zinc-900">
        Godziny przyjęć
      </h2>
      <p className="mt-1 text-sm text-zinc-600">
        Pacjenci rezerwują wizyty tylko w tych godzinach.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {WEEKDAY_NAMES.map((name, weekday) => {
          const item = weekdays[weekday];
          return (
            <div
              key={name}
              className="flex flex-wrap items-center gap-3 rounded-md border border-zinc-100 bg-zinc-50 px-4 py-3"
            >
              <label className="flex w-40 items-center gap-2 text-sm font-medium text-zinc-900">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(event) =>
                    updateWeekday(weekday, { enabled: event.target.checked })
                  }
                  className="h-4 w-4 accent-violet-700"
                />
                {name}
              </label>
              {item.enabled ? (
                <div className="flex items-center gap-2 text-sm text-zinc-600">
                  <input
                    type="time"
                    value={item.start_time}
                    onChange={(event) =>
                      updateWeekday(weekday, {
                        start_time: event.target.value,
                      })
                    }
                    className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  />
                  <span>–</span>
                  <input
                    type="time"
                    value={item.end_time}
                    onChange={(event) =>
                      updateWeekday(weekday, {
                        end_time: event.target.value,
                      })
                    }
                    className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  />
                </div>
              ) : (
                <span className="text-sm text-zinc-400">Dzień wolny</span>
              )}
            </div>
          );
        })}
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-violet-700 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Zapisywanie…" : "Zapisz godziny"}
        </button>
      </div>
    </div>
  );
}
