"use client";

import { useEffect, useState } from "react";

import { useAuthorizedFetch } from "@/features/auth/auth-context";
import { ApiError, apiFetch } from "@/lib/api";
import { WEEKDAY_NAMES } from "@/lib/format";
import type { Doctor, WorkingHours, WorkingHoursEntry } from "@/lib/types";

type WeekdayEditor = {
  enabled: boolean;
  start_time: string;
  end_time: string;
};

/** Edytor tygodniowych godzin przyjęć lekarza — lekarz edytuje własne,
 *  administrator może edytować godziny dowolnego lekarza. */
export function AvailabilityEditor({ doctor }: { doctor: Doctor | null }) {
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
