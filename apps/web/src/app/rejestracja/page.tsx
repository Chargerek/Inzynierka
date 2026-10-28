"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api";
import type { Sex } from "@/lib/types";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sex, setSex] = useState<Sex | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError("Hasła nie są takie same.");
      return;
    }
    if (sex === null) {
      setError("Wybierz płeć.");
      return;
    }
    if (!consent) {
      setError("Musisz wyrazić zgodę na przetwarzanie danych osobowych.");
      return;
    }

    setSubmitting(true);
    try {
      await register({
        first_name: firstName,
        last_name: lastName,
        email: email.trim(),
        password,
        phone: phone.trim() || null,
        sex,
        consent_accepted: consent,
      });
      router.replace("/panel");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Nie udało się utworzyć konta. Spróbuj ponownie.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <section className="bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 px-4 py-16 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
            Rejestracja
          </h1>
          <p className="max-w-xl text-base leading-7 text-zinc-600">
            Załóż konto pacjenta, aby rezerwować wizyty online.
          </p>
        </div>
      </section>

      <section className="flex justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
              Imię
              <input
                type="text"
                required
                autoComplete="given-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="rounded-md border border-zinc-300 bg-gray-100 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
              Nazwisko
              <input
                type="text"
                required
                autoComplete="family-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="rounded-md border border-zinc-300 bg-gray-100 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
            Adres e-mail
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-md border border-zinc-300 bg-gray-100 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
            Telefon (opcjonalnie)
            <input
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="rounded-md border border-zinc-300 bg-gray-100 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              placeholder="500 100 200"
            />
          </label>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-sm font-medium text-zinc-700">Płeć</legend>
            <div className="flex gap-2">
              {(
                [
                  { value: "female", label: "Kobieta" },
                  { value: "male", label: "Mężczyzna" },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                    sex === option.value
                      ? "border-violet-600 bg-violet-50 font-medium text-violet-900"
                      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="sex"
                    required
                    value={option.value}
                    checked={sex === option.value}
                    onChange={() => setSex(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
            Hasło
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-md border border-zinc-300 bg-gray-100 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
            <span className="text-xs font-normal text-zinc-500">
              Minimum 8 znaków, co najmniej jedna litera i jedna cyfra.
            </span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
            Powtórz hasło
            <input
              type="password"
              required
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              className="rounded-md border border-zinc-300 bg-gray-100 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
          </label>

          <label className="flex items-start gap-2.5 text-sm text-zinc-700">
            <input
              type="checkbox"
              required
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-violet-700"
            />
            <span>
              Wyrażam zgodę na przetwarzanie moich danych osobowych (w tym
              danych o zdrowiu) w celu rezerwacji wizyt i prowadzenia
              dokumentacji.{" "}
              <span className="text-zinc-500">
                To wersja demonstracyjna — dane są przechowywane lokalnie.
              </span>
            </span>
          </label>

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Tworzenie konta…" : "Utwórz konto"}
          </button>
        </form>

          <p className="mt-6 text-center text-sm text-zinc-600">
            Masz już konto?{" "}
            <Link
              href="/login"
              className="font-medium text-zinc-900 underline underline-offset-4"
            >
              Zaloguj się
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
