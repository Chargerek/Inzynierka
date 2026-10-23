"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useAuth, useAuthorizedFetch } from "@/features/auth/auth-context";
import { RoleGuard } from "@/features/auth/role-guard";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Appointment } from "@/lib/types";

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

function StatusBadge({ status }: { status: Appointment["status"] }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export default function PatientPanelPage() {
  return (
    <RoleGuard roles={["patient"]}>
      <PatientPanel />
    </RoleGuard>
  );
}

function PatientPanel() {
  const { user } = useAuth();
  const authorizedFetch = useAuthorizedFetch();
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const loadAppointments = useCallback(() => {
    authorizedFetch<Appointment[]>("/appointments/me")
      .then(setAppointments)
      .catch((err: unknown) =>
        setError(
          err instanceof ApiError
            ? err.message
            : "Nie udało się pobrać wizyt.",
        ),
      );
  }, [authorizedFetch]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const handleCancel = async (appointment: Appointment) => {
    setError(null);
    setCancellingId(appointment.id);
    try {
      await authorizedFetch(`/appointments/${appointment.id}/cancel`, {
        method: "POST",
      });
      loadAppointments();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Nie udało się odwołać wizyty.",
      );
    } finally {
      setCancellingId(null);
    }
  };

  const now = new Date();
  const upcoming = (appointments ?? []).filter(
    (appointment) =>
      new Date(appointment.start_at) >= now &&
      appointment.status !== "cancelled",
  );
  const past = (appointments ?? []).filter(
    (appointment) =>
      new Date(appointment.start_at) < now ||
      appointment.status === "cancelled",
  );

  return (
    <div className="flex flex-1 flex-col">
      <section className="bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 px-4 py-16 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
            Panel pacjenta
          </h1>
          <p className="max-w-xl text-base leading-7 text-zinc-600">
            Witaj, {user?.first_name}. Tutaj zarządzasz swoimi wizytami.
          </p>
          <Link
            href="/panel/umow"
            className="mt-2 rounded-md bg-violet-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-600"
          >
            Umów wizytę
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-16">
        {error ? (
          <p className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <h2 className="text-xl font-semibold text-zinc-900">
          Nadchodzące wizyty
        </h2>
        <div className="mt-4 flex flex-col gap-4">
          {appointments === null ? (
            <p className="text-sm text-zinc-500">Ładowanie wizyt…</p>
          ) : upcoming.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
              Nie masz zaplanowanych wizyt.{" "}
              <Link
                href="/panel/umow"
                className="font-medium text-zinc-900 underline underline-offset-4"
              >
                Umów pierwszą wizytę
              </Link>
              .
            </div>
          ) : (
            upcoming.map((appointment) => (
              <div
                key={appointment.id}
                className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-zinc-900">
                    {appointment.service.name}
                    {appointment.doctor
                      ? ` — ${appointment.doctor.first_name} ${appointment.doctor.last_name}`
                      : ""}
                  </p>
                  <p className="mt-1 text-sm capitalize text-zinc-600">
                    {formatDateTime(appointment.start_at)}
                  </p>
                  {appointment.notes ? (
                    <p className="mt-1 text-sm text-zinc-500">
                      {appointment.notes}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={appointment.status} />
                  <button
                    type="button"
                    onClick={() => handleCancel(appointment)}
                    disabled={cancellingId === appointment.id}
                    className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {cancellingId === appointment.id
                      ? "Odwoływanie…"
                      : "Odwołaj"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {past.length > 0 ? (
          <>
            <h2 className="mt-12 text-xl font-semibold text-zinc-900">
              Historia wizyt
            </h2>
            <div className="mt-4 flex flex-col gap-4">
              {past.map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-zinc-900">
                      {appointment.service.name}
                      {appointment.doctor
                        ? ` — ${appointment.doctor.first_name} ${appointment.doctor.last_name}`
                        : ""}
                    </p>
                    <p className="mt-1 text-sm capitalize text-zinc-600">
                      {formatDateTime(appointment.start_at)}
                    </p>
                  </div>
                  <StatusBadge status={appointment.status} />
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
