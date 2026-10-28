"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuthorizedFetch } from "@/features/auth/auth-context";
import { RoleGuard } from "@/features/auth/role-guard";
import { AvailabilityEditor } from "@/features/availability/availability-editor";
import { PatientRecords } from "@/features/findings/patient-records";
import { ServicesManager } from "@/features/services/services-manager";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type {
  AdminCreateUserPayload,
  AdminPatient,
  AdminUser,
  Doctor,
  Sex,
  UserRole,
} from "@/lib/types";

const ROLE_LABELS: Record<UserRole, string> = {
  patient: "Pacjent",
  dermatologist: "Lekarz",
  admin: "Administrator",
};

const SEX_LABELS: Record<Sex, string> = {
  female: "Kobieta",
  male: "Mężczyzna",
};

export default function AdminPage() {
  return (
    <RoleGuard roles={["admin"]}>
      <AdminPanel />
    </RoleGuard>
  );
}

function AdminPanel() {
  const [tab, setTab] = useState<
    "uzytkownicy" | "lekarze" | "pacjenci" | "kartoteka" | "uslugi"
  >("uzytkownicy");

  return (
    <div className="flex flex-1 flex-col">
      <section className="bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 px-4 py-16 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
            Panel administratora
          </h1>
          <p className="max-w-xl text-base leading-7 text-zinc-600">
            Zarządzanie użytkownikami, lekarzami, pacjentami i usługami
            gabinetu.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-1 rounded-lg bg-zinc-100 p-1 text-sm font-medium">
            {(
              [
                { id: "uzytkownicy", label: "Użytkownicy" },
                { id: "lekarze", label: "Lekarze" },
                { id: "pacjenci", label: "Pacjenci" },
                { id: "kartoteka", label: "Kartoteka" },
                { id: "uslugi", label: "Usługi" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded-md px-4 py-2 transition-colors ${
                  tab === item.id
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-16">
        {tab === "uzytkownicy" ? (
          <UsersTab />
        ) : tab === "lekarze" ? (
          <DoctorsTab />
        ) : tab === "pacjenci" ? (
          <PatientsTab />
        ) : tab === "kartoteka" ? (
          <PatientRecords />
        ) : (
          <ServicesManager />
        )}
      </section>
    </div>
  );
}

/* ------------------------------- Użytkownicy ------------------------------ */

function UsersTab() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="flex flex-col gap-10">
      <CreateUserForm onCreated={() => setRefreshKey((key) => key + 1)} />
      <UsersTable refreshKey={refreshKey} />
    </div>
  );
}

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const authorizedFetch = useAuthorizedFetch();
  const [role, setRole] = useState<UserRole>("dermatologist");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [sex, setSex] = useState<"" | Sex>("");
  const [specialization, setSpecialization] = useState("Dermatologia");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inputClass =
    "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const payload: AdminCreateUserPayload = {
      email: email.trim(),
      password,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      role,
    };
    if (phone.trim()) payload.phone = phone.trim();
    if (sex) payload.sex = sex;
    if (role === "dermatologist") {
      payload.specialization = specialization.trim() || "Dermatologia";
      if (bio.trim()) payload.bio = bio.trim();
    }

    try {
      const created = await authorizedFetch<AdminUser>("/admin/users", {
        method: "POST",
        body: payload,
      });
      setMessage(
        `Utworzono konto ${ROLE_LABELS[created.role].toLowerCase()}: ${created.email}`,
      );
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setSex("");
      setBio("");
      onCreated();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Nie udało się utworzyć konta.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-zinc-200 bg-white p-6"
    >
      <h2 className="text-lg font-semibold text-zinc-900">
        Utwórz nowe konto
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Konto jest aktywne od razu — przekaż dane logowania użytkownikowi.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-zinc-700">
          Rola
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
            className={inputClass}
          >
            <option value="dermatologist">Lekarz</option>
            <option value="patient">Pacjent</option>
            <option value="admin">Administrator</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-zinc-700">
          E-mail
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700">
          Imię
          <input
            type="text"
            required
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700">
          Nazwisko
          <input
            type="text"
            required
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700">
          Hasło
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
            aria-describedby="admin-user-password-hint"
          />
          <span
            id="admin-user-password-hint"
            className="mt-1 block text-xs font-normal text-zinc-500"
          >
            Min. 8 znaków, w tym duża litera i cyfra.
          </span>
        </label>
        <label className="block text-sm font-medium text-zinc-700">
          Telefon (opcjonalnie)
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700">
          Płeć (opcjonalnie)
          <select
            value={sex}
            onChange={(event) => setSex(event.target.value as "" | Sex)}
            className={inputClass}
          >
            <option value="">Nie podano</option>
            <option value="female">Kobieta</option>
            <option value="male">Mężczyzna</option>
          </select>
        </label>
        {role === "dermatologist" ? (
          <>
            <label className="block text-sm font-medium text-zinc-700">
              Specjalizacja
              <input
                type="text"
                value={specialization}
                onChange={(event) => setSpecialization(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-zinc-700 sm:col-span-2">
              Bio (opcjonalnie)
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                rows={2}
                className={inputClass}
              />
            </label>
          </>
        ) : null}
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

      <button
        type="submit"
        disabled={loading}
        className="mt-4 rounded-md bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Tworzenie…" : "Utwórz konto"}
      </button>
    </form>
  );
}

function UsersTable({ refreshKey }: { refreshKey: number }) {
  const authorizedFetch = useAuthorizedFetch();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    authorizedFetch<AdminUser[]>("/admin/users")
      .then((data) => {
        if (active) {
          setUsers(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Nie udało się pobrać użytkowników.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [authorizedFetch, refreshKey]);

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900">Konta użytkowników</h2>
      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {users === null ? (
        <p className="mt-4 text-sm text-zinc-500">Ładowanie…</p>
      ) : users.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">Brak użytkowników.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Użytkownik</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">Rola</th>
                <th className="px-4 py-3 font-medium">Utworzono</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {user.first_name} {user.last_name}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{user.email}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {ROLE_LABELS[user.role]}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {formatDateTime(user.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Lekarze -------------------------------- */

function DoctorsTab() {
  const authorizedFetch = useAuthorizedFetch();
  const [doctors, setDoctors] = useState<Doctor[] | null>(null);
  const [emails, setEmails] = useState<Map<number, string>>(new Map());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch<Doctor[]>("/doctors"),
      authorizedFetch<AdminUser[]>("/admin/users"),
    ])
      .then(([doctorList, userList]) => {
        if (!active) return;
        setDoctors(doctorList);
        setEmails(new Map(userList.map((user) => [user.id, user.email])));
        setSelectedId((current) => current ?? doctorList[0]?.id ?? null);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Nie udało się pobrać lekarzy.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [authorizedFetch]);

  const selected = useMemo(
    () => doctors?.find((doctor) => doctor.id === selectedId) ?? null,
    [doctors, selectedId],
  );

  if (error) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </p>
    );
  }

  if (doctors === null) {
    return <p className="text-sm text-zinc-500">Ładowanie lekarzy…</p>;
  }

  if (doctors.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Brak lekarzy. Utwórz konto lekarza w zakładce „Użytkownicy”.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap gap-2">
        {doctors.map((doctor) => (
          <button
            key={doctor.id}
            type="button"
            onClick={() => setSelectedId(doctor.id)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              selectedId === doctor.id
                ? "border-violet-600 bg-violet-600 text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            {doctor.first_name} {doctor.last_name}
          </button>
        ))}
      </div>

      {selected ? (
        <div className="flex flex-col gap-8">
          <div className="rounded-lg border border-zinc-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-zinc-900">
              {selected.first_name} {selected.last_name}
            </h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-zinc-500">E-mail</dt>
                <dd className="font-medium text-zinc-900">
                  {emails.get(selected.user_id) ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Specjalizacja</dt>
                <dd className="font-medium text-zinc-900">
                  {selected.specialization}
                </dd>
              </div>
            </dl>
            {selected.bio ? (
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                {selected.bio}
              </p>
            ) : null}
          </div>

          <AvailabilityEditor key={selected.id} doctor={selected} />
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------- Pacjenci ------------------------------- */

function PatientsTab() {
  const authorizedFetch = useAuthorizedFetch();
  const [patients, setPatients] = useState<AdminPatient[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    authorizedFetch<AdminPatient[]>("/admin/patients")
      .then((data) => {
        if (active) {
          setPatients(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Nie udało się pobrać pacjentów.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [authorizedFetch]);

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleDateString("pl-PL") : "—";

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900">Pacjenci gabinetu</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Podgląd kont pacjentów w razie zgłoszonych problemów.
      </p>
      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {patients === null ? (
        <p className="mt-4 text-sm text-zinc-500">Ładowanie…</p>
      ) : patients.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">Brak pacjentów.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Pacjent</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">Telefon</th>
                <th className="px-4 py-3 font-medium">Płeć</th>
                <th className="px-4 py-3 font-medium">Data ur.</th>
                <th className="px-4 py-3 font-medium">Wizyty</th>
                <th className="px-4 py-3 font-medium">Raporty</th>
                <th className="px-4 py-3 font-medium">Konto od</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {patients.map((patient) => (
                <tr key={patient.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {patient.first_name} {patient.last_name}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{patient.email}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {patient.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {patient.sex ? SEX_LABELS[patient.sex] : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {formatDate(patient.birth_date)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {patient.appointments_count}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {patient.reports_count}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {formatDate(patient.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
