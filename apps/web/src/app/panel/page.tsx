"use client";

import { RoleGuard } from "@/features/auth/role-guard";
import { useAuth } from "@/features/auth/auth-context";

const UPCOMING_STEPS = [
  {
    title: "Rezerwacja wizyty",
    description:
      "Wybór usługi, lekarza i terminu pojawi się tutaj w kolejnym etapie prac.",
  },
  {
    title: "Historia wizyt",
    description:
      "Lista zaplanowanych i odbytych wizyt wraz z możliwością odwołania.",
  },
  {
    title: "Dokumentacja skóry",
    description:
      "Zmiany skórne zaznaczone przez lekarza na mapie ciała wraz ze zdjęciami.",
  },
];

export default function PatientPanelPage() {
  const { user } = useAuth();

  return (
    <RoleGuard roles={["patient"]}>
      <div className="mx-auto w-full max-w-5xl px-4 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          Panel pacjenta
        </h1>
        <div className="mt-3 h-1 w-16 rounded-full bg-violet-700" />
        <p className="mt-2 text-sm text-zinc-600">
          Witaj, {user?.first_name}. Tutaj zarządzasz swoimi wizytami i
          dokumentacją.
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
