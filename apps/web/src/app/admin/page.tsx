"use client";

import { RoleGuard } from "@/features/auth/role-guard";
import { useAuth } from "@/features/auth/auth-context";

const UPCOMING_STEPS = [
  {
    title: "Usługi i cennik",
    description:
      "Dodawanie, edycja i usuwanie usług oferowanych przez gabinet pojawi się w kolejnym etapie.",
  },
  {
    title: "Użytkownicy",
    description:
      "Lista kont pacjentów i lekarzy oraz tworzenie nowych kont lekarzy.",
  },
  {
    title: "Godziny pracy",
    description:
      "Ustalanie harmonogramu pracy lekarzy, od którego liczone są wolne terminy.",
  },
];

export default function AdminPanelPage() {
  const { user } = useAuth();

  return (
    <RoleGuard roles={["admin"]}>
      <div className="mx-auto w-full max-w-5xl px-4 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          Panel administratora
        </h1>
        <div className="mt-3 h-1 w-16 rounded-full bg-violet-700" />
        <p className="mt-2 text-sm text-zinc-600">
          Witaj, {user?.first_name}. Tutaj zarządzasz gabinetem, usługami i
          kontami użytkowników.
        </p>

        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {UPCOMING_STEPS.map((step) => (
            <div
              key={step.title}
              className="rounded-lg border border-dashed border-zinc-300 bg-white p-6"
            >
              <h2 className="text-lg font-semibold text-zinc-900">
                {step.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </RoleGuard>
  );
}
