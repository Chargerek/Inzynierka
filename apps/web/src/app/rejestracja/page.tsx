"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError("Hasła nie są takie same.");
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
