"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError, apiFetch } from "@/lib/api";
import type { Service } from "@/lib/types";

export default function PriceListPage() {
  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Service[]>("/services")
      .then(setServices)
      .catch((err: unknown) =>
        setError(
          err instanceof ApiError
            ? err.message
            : "Nie udało się pobrać cennika.",
        ),
      );
  }, []);

  return (
    <div className="flex flex-1 flex-col">
      <section className="bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 px-4 py-16 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
            Cennik usług
          </h1>
          <p className="max-w-xl text-base leading-7 text-zinc-600">
            Aktualne usługi oferowane przez gabinet. Czas trwania i cena
            wizyty są podane przy każdej pozycji.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-16">
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        {error ? (
          <p className="px-6 py-8 text-sm text-red-700">{error}</p>
        ) : services === null ? (
          <p className="px-6 py-8 text-sm text-zinc-500">Ładowanie cennika…</p>
        ) : services.length === 0 ? (
          <p className="px-6 py-8 text-sm text-zinc-500">
            Cennik jest chwilowo niedostępny.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-6 py-3 font-medium">Usługa</th>
                <th className="px-6 py-3 font-medium">Czas trwania</th>
                <th className="px-6 py-3 text-right font-medium">Cena</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {services.map((service) => (
                <tr key={service.id}>
                  <td className="px-6 py-4 font-medium text-zinc-900">
                    {service.name}
                  </td>
                  <td className="px-6 py-4 text-zinc-600">
                    {service.duration_minutes} min
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-zinc-900">
                    {Number(service.price).toFixed(2)} zł
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            href="/rejestracja"
            className="inline-block rounded-md bg-violet-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-600"
          >
            Umów wizytę
          </Link>
        </div>
      </section>
    </div>
  );
}
