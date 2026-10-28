"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { useAuthorizedFetch } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api";
import type { Service } from "@/lib/types";

const EMPTY_SERVICE_FORM = {
  name: "",
  duration_minutes: "30",
  price: "",
};

type ServiceFormState = typeof EMPTY_SERVICE_FORM;

/** Zarządzanie cennikiem (dodawanie, edycja, usuwanie usług) —
 *  współdzielone między panel administratora i panel lekarza. */
export function ServicesManager() {
  const authorizedFetch = useAuthorizedFetch();
  const [services, setServices] = useState<Service[] | null>(null);
  const [form, setForm] = useState<ServiceFormState>(EMPTY_SERVICE_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadServices = useCallback(() => {
    authorizedFetch<Service[]>("/services")
      .then(setServices)
      .catch(() => setError("Nie udało się pobrać listy usług."));
  }, [authorizedFetch]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const resetForm = () => {
    setForm(EMPTY_SERVICE_FORM);
    setEditingId(null);
  };

  const startEdit = (service: Service) => {
    setEditingId(service.id);
    setForm({
      name: service.name,
      duration_minutes: String(service.duration_minutes),
      price: service.price,
    });
    setError(null);
    setMessage(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const duration = Number.parseInt(form.duration_minutes, 10);
    if (!form.name.trim()) {
      setError("Nazwa usługi jest wymagana.");
      return;
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      setError("Czas trwania musi być dodatnią liczbą minut.");
      return;
    }
    if (!form.price || Number(form.price) < 0) {
      setError("Cena musi być nieujemną liczbą.");
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        name: form.name.trim(),
        duration_minutes: duration,
        price: form.price,
      };
      if (editingId === null) {
        await authorizedFetch("/services", { method: "POST", body });
        setMessage("Usługa została dodana.");
      } else {
        await authorizedFetch(`/services/${editingId}`, {
          method: "PUT",
          body,
        });
        setMessage("Usługa została zaktualizowana.");
      }
      resetForm();
      loadServices();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Nie udało się zapisać usługi.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (service: Service) => {
    if (!window.confirm(`Czy na pewno usunąć usługę „${service.name}"?`)) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      await authorizedFetch(`/services/${service.id}`, { method: "DELETE" });
      setMessage("Usługa została usunięta.");
      if (editingId === service.id) {
        resetForm();
      }
      loadServices();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Nie udało się usunąć usługi.",
      );
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-zinc-200 bg-white p-6"
      >
        <h2 className="text-xl font-semibold text-zinc-900">
          {editingId === null ? "Dodaj usługę" : "Edytuj usługę"}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              htmlFor="service-name"
              className="text-sm font-medium text-zinc-900"
            >
              Nazwa
            </label>
            <input
              id="service-name"
              type="text"
              required
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
          </div>
          <div>
            <label
              htmlFor="service-duration"
              className="text-sm font-medium text-zinc-900"
            >
              Czas trwania (min)
            </label>
            <input
              id="service-duration"
              type="number"
              min={1}
              required
              value={form.duration_minutes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  duration_minutes: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
          </div>
          <div>
            <label
              htmlFor="service-price"
              className="text-sm font-medium text-zinc-900"
            >
              Cena (zł)
            </label>
            <input
              id="service-price"
              type="number"
              min={0}
              step="0.01"
              required
              value={form.price}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  price: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
          </div>
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

        <div className="mt-6 flex justify-end gap-3">
          {editingId !== null ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
            >
              Anuluj edycję
            </button>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-violet-700 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? "Zapisywanie…"
              : editingId === null
                ? "Dodaj usługę"
                : "Zapisz zmiany"}
          </button>
        </div>
      </form>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-zinc-900">Lista usług</h2>
        {services === null ? (
          <p className="mt-4 text-sm text-zinc-500">Ładowanie…</p>
        ) : services.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">Brak usług.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="py-2 pr-4 font-medium">Nazwa</th>
                  <th className="py-2 pr-4 font-medium">Czas</th>
                  <th className="py-2 pr-4 font-medium">Cena</th>
                  <th className="py-2 font-medium">
                    <span className="sr-only">Akcje</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr
                    key={service.id}
                    className="border-b border-zinc-100 last:border-0"
                  >
                    <td className="py-3 pr-4 text-zinc-900">{service.name}</td>
                    <td className="py-3 pr-4 text-zinc-600">
                      {service.duration_minutes} min
                    </td>
                    <td className="py-3 pr-4 text-zinc-600">
                      {Number(service.price).toFixed(2)} zł
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => startEdit(service)}
                        className="mr-2 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
                      >
                        Edytuj
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(service)}
                        className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
                      >
                        Usuń
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
