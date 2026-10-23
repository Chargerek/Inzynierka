"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuthorizedFetch } from "@/features/auth/auth-context";
import { RoleGuard } from "@/features/auth/role-guard";
import { ApiError, apiFetch } from "@/lib/api";
import {
  addDays,
  formatDateTime,
  formatTime,
  toLocalDateString,
} from "@/lib/format";
import type {
  Appointment,
  Availability,
  Doctor,
  Service,
  TimeSlot,
} from "@/lib/types";

const STEPS = ["Usługa", "Lekarz", "Termin", "Potwierdzenie"] as const;

export default function BookAppointmentPage() {
  return (
    <RoleGuard roles={["patient"]}>
      <BookingWizard />
    </RoleGuard>
  );
}

function BookingWizard() {
  const authorizedFetch = useAuthorizedFetch();

  const [step, setStep] = useState(0);
  const [services, setServices] = useState<Service[] | null>(null);
  const [doctors, setDoctors] = useState<Doctor[] | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [date, setDate] = useState<string>(toLocalDateString(addDays(new Date(), 1)));
  const [slots, setSlots] = useState<TimeSlot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slot, setSlot] = useState<TimeSlot | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState<Appointment | null>(null);

  useEffect(() => {
    apiFetch<Service[]>("/services")
      .then(setServices)
      .catch(() => setError("Nie udało się pobrać listy usług."));
    apiFetch<Doctor[]>("/doctors")
      .then(setDoctors)
      .catch(() => setError("Nie udało się pobrać listy lekarzy."));
  }, []);

  useEffect(() => {
    if (step !== 2 || !doctor || !service) {
      return;
    }
    let active = true;
    apiFetch<Availability>(
      `/availability?doctor_id=${doctor.id}&service_id=${service.id}&date=${date}`,
    )
      .then((response) => {
        if (active) {
          setSlots(response.slots);
        }
      })
      .catch(() => {
        if (active) {
          setError("Nie udało się pobrać dostępnych terminów.");
        }
      })
      .finally(() => {
        if (active) {
          setSlotsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [step, doctor, service, date]);

  const handleConfirm = async () => {
    if (!service || !doctor || !slot) {
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const appointment = await authorizedFetch<Appointment>("/appointments", {
        method: "POST",
        body: {
          doctor_id: doctor.id,
          service_id: service.id,
          start_at: slot.start,
          notes: notes.trim() || null,
        },
      });
      setBooked(appointment);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Nie udało się zarezerwować wizyty.",
      );
      if (err instanceof ApiError && err.status === 409) {
        setSlots(null);
        setSlot(null);
        setSlotsLoading(true);
        setStep(2);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const minDate = toLocalDateString(new Date());
  const maxDate = toLocalDateString(addDays(new Date(), 60));

  if (booked) {
    return (
      <div className="flex flex-1 flex-col">
        <section className="bg-white">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 px-4 py-16 text-center">
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
              Wizyta zarezerwowana
            </h1>
            <p className="max-w-xl text-base leading-7 text-zinc-600">
              {booked.service.name} — {booked.doctor?.first_name}{" "}
              {booked.doctor?.last_name},{" "}
              <span className="capitalize">
                {formatDateTime(booked.start_at)}
              </span>
              .
            </p>
            <Link
              href="/panel"
              className="mt-2 rounded-md bg-violet-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-600"
            >
              Wróć do panelu
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <section className="bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 px-4 py-16 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
            Umów wizytę
          </h1>
          <ol className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm">
            {STEPS.map((label, index) => (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    index === step
                      ? "bg-violet-700 text-white"
                      : index < step
                        ? "bg-zinc-200 text-zinc-700"
                        : "bg-zinc-100 text-zinc-400"
                  }`}
                >
                  {index + 1}
                </span>
                <span
                  className={
                    index === step
                      ? "font-medium text-zinc-900"
                      : "text-zinc-500"
                  }
                >
                  {label}
                </span>
                {index < STEPS.length - 1 ? (
                  <span className="mx-1 text-zinc-300">→</span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-16">
        {error ? (
          <p className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {step === 0 ? (
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">
              Wybierz usługę
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {(services ?? []).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setService(item);
                    setSlots(null);
                    setSlot(null);
                  }}
                  className={`rounded-lg border bg-white p-6 text-left transition-colors ${
                    service?.id === item.id
                      ? "border-violet-500 ring-2 ring-violet-200"
                      : "border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  <p className="font-semibold text-zinc-900">{item.name}</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {item.duration_minutes} min
                  </p>
                  <p className="mt-2 text-lg font-semibold text-zinc-900">
                    {Number(item.price).toFixed(2)} zł
                  </p>
                </button>
              ))}
            </div>
            {services === null ? (
              <p className="mt-4 text-sm text-zinc-500">Ładowanie usług…</p>
            ) : null}
          </div>
        ) : null}

        {step === 1 ? (
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">
              Wybierz lekarza
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {(doctors ?? []).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setDoctor(item);
                    setSlots(null);
                    setSlot(null);
                  }}
                  className={`rounded-lg border bg-white p-6 text-left transition-colors ${
                    doctor?.id === item.id
                      ? "border-violet-500 ring-2 ring-violet-200"
                      : "border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  <p className="font-semibold text-zinc-900">
                    {item.first_name} {item.last_name}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {item.specialization}
                  </p>
                  {item.bio ? (
                    <p className="mt-2 text-sm text-zinc-500">{item.bio}</p>
                  ) : null}
                </button>
              ))}
            </div>
            {doctors === null ? (
              <p className="mt-4 text-sm text-zinc-500">Ładowanie lekarzy…</p>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">
              Wybierz termin
            </h2>
            <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-6">
              <label className="flex max-w-xs flex-col gap-1.5 text-sm font-medium text-zinc-700">
                Data wizyty
                <input
                  type="date"
                  value={date}
                  min={minDate}
                  max={maxDate}
                  onChange={(event) => {
                    setDate(event.target.value);
                    setSlots(null);
                    setSlot(null);
                    setSlotsLoading(true);
                  }}
                  className="rounded-md border border-zinc-300 bg-gray-100 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                />
              </label>

              <div className="mt-6">
                {slotsLoading ? (
                  <p className="text-sm text-zinc-500">
                    Szukanie wolnych terminów…
                  </p>
                ) : slots === null ? null : slots.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    Brak wolnych terminów w tym dniu. Wybierz inną datę.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {slots.map((item) => (
                      <button
                        key={item.start}
                        type="button"
                        onClick={() => setSlot(item)}
                        className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                          slot?.start === item.start
                            ? "border-violet-500 bg-violet-50 text-violet-800"
                            : "border-zinc-300 bg-white text-zinc-900 hover:border-zinc-500"
                        }`}
                      >
                        {formatTime(item.start)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 && service && doctor && slot ? (
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">
              Potwierdź rezerwację
            </h2>
            <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-6">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">
                    Usługa
                  </dt>
                  <dd className="mt-1 font-medium text-zinc-900">
                    {service.name} ({service.duration_minutes} min)
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">
                    Lekarz
                  </dt>
                  <dd className="mt-1 font-medium text-zinc-900">
                    {doctor.first_name} {doctor.last_name}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">
                    Termin
                  </dt>
                  <dd className="mt-1 font-medium capitalize text-zinc-900">
                    {formatDateTime(slot.start)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">
                    Cena
                  </dt>
                  <dd className="mt-1 font-medium text-zinc-900">
                    {Number(service.price).toFixed(2)} zł
                  </dd>
                </div>
              </dl>
              <label className="mt-6 flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
                Uwagi dla lekarza (opcjonalnie)
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="rounded-md border border-zinc-300 bg-gray-100 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  placeholder="Np. zmiana skórna na dłoni, pojawiła się miesiąc temu"
                />
              </label>
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            disabled={step === 0}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Wróć
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 1) {
                  setSlotsLoading(true);
                }
                setStep((current) => current + 1);
              }}
              disabled={
                (step === 0 && !service) ||
                (step === 1 && !doctor) ||
                (step === 2 && !slot)
              }
              className="rounded-md bg-violet-700 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Dalej
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="rounded-md bg-violet-700 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Rezerwowanie…" : "Potwierdź rezerwację"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
