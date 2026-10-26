"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api";
import type { UserRole } from "@/lib/types";

const HOME_BY_ROLE: Record<UserRole, string> = {
  patient: "/panel",
  dermatologist: "/doctor",
  admin: "/admin",
};

export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) router.replace(HOME_BY_ROLE[user.role]);
  }, [user, router]);

  if (user) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loggedIn = await login({ email: email.trim(), password });
      router.replace(HOME_BY_ROLE[loggedIn.role]);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Nie udało się zalogować. Spróbuj ponownie.",
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
            Logowanie
          </h1>
          <p className="max-w-xl text-base leading-7 text-zinc-600">
            Zaloguj się, aby zarządzać swoimi wizytami.
          </p>
        </div>
      </section>

      <section className="flex justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
            Adres e-mail
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-md border border-zinc-300 bg-gray-100 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              placeholder="jan.nowak@gabinet.pl"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
            Hasło
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-md border border-zinc-300 bg-gray-100 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              placeholder="••••••••"
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
            {submitting ? "Logowanie…" : "Zaloguj się"}
          </button>
        </form>

          <p className="mt-6 text-center text-sm text-zinc-600">
            Nie masz konta?{" "}
            <Link
              href="/rejestracja"
              className="font-medium text-zinc-900 underline underline-offset-4"
            >
              Zarejestruj się
            </Link>
          </p>

          <div className="mt-6 rounded-md bg-zinc-50 p-3 text-xs leading-5 text-zinc-500">
            Konta demo (hasło <code>Demo123!</code>): pacjent{" "}
            <code>jan.nowak@gabinet.pl</code>, lekarz{" "}
            <code>lekarz@gabinet.pl</code>, admin <code>admin@gabinet.pl</code>.
          </div>
        </div>
      </section>
    </div>
  );
}
