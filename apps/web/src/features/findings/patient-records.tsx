"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuthorizedFetch } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/format";
import type {
  BodyFigure,
  DoctorPatient,
  PatientSummary,
  ReportSummary,
} from "@/lib/types";

import { ReportEditor } from "./report-editor";

type EditorState = {
  patient: PatientSummary;
  reportId: number | null;
  initialFigure: BodyFigure;
};

function plural(count: number, one: string, few: string, many: string) {
  if (count === 1) return one;
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return few;
  }
  return many;
}

export function PatientRecords() {
  const authorizedFetch = useAuthorizedFetch();
  const [patients, setPatients] = useState<DoctorPatient[] | null>(null);
  const [patientId, setPatientId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [reports, setReports] = useState<ReportSummary[] | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    authorizedFetch<DoctorPatient[]>("/doctor/patients")
      .then((data) => {
        if (active) setPatients(data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Nie udało się pobrać listy pacjentów.",
        );
      });
    return () => {
      active = false;
    };
  }, [authorizedFetch, reloadKey]);

  useEffect(() => {
    let active = true;
    const query = patientId === null ? "" : `?patient_id=${patientId}`;
    authorizedFetch<ReportSummary[]>(`/reports${query}`)
      .then((data) => {
        if (active) setReports(data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Nie udało się pobrać raportów.",
        );
      });
    return () => {
      active = false;
    };
  }, [authorizedFetch, patientId, reloadKey]);

  const selectedPatient =
    patients?.find((patient) => patient.id === patientId) ?? null;

  const filteredPatients = useMemo(() => {
    const phrase = search.trim().toLowerCase();
    if (!patients || !phrase) return patients ?? [];
    return patients.filter((patient) =>
      `${patient.first_name} ${patient.last_name}`
        .toLowerCase()
        .includes(phrase),
    );
  }, [patients, search]);

  const totalReports =
    patients?.reduce((sum, patient) => sum + patient.reports_count, 0) ?? 0;

  const selectPatient = (id: number | null) => {
    if (id === patientId) return;
    setReports(null);
    setPatientId(id);
  };

  const openReport = (report: ReportSummary) => {
    setEditor({
      patient: report.patient,
      reportId: report.id,
      initialFigure: report.body_figure,
    });
  };

  const openNewReport = () => {
    if (!selectedPatient) return;
    setEditor({
      patient: {
        id: selectedPatient.id,
        first_name: selectedPatient.first_name,
        last_name: selectedPatient.last_name,
      },
      reportId: null,
      initialFigure: reports?.[0]?.body_figure ?? "male",
    });
  };

  const closeEditor = () => {
    setEditor(null);
    setReports(null);
    setReloadKey((key) => key + 1);
  };

  if (editor) {
    return (
      <ReportEditor
        key={editor.reportId ?? "new"}
        patient={editor.patient}
        reportId={editor.reportId}
        initialFigure={editor.initialFigure}
        onBack={closeEditor}
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="flex flex-col rounded-lg border border-zinc-200 bg-white lg:self-start">
        <div className="border-b border-zinc-100 p-4">
          <h2 className="text-base font-semibold text-zinc-900">Pacjenci</h2>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Szukaj pacjenta…"
            aria-label="Szukaj pacjenta"
            className="mt-3 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
          />
        </div>
        {patients === null ? (
          <p className="p-4 text-sm text-zinc-500">Ładowanie…</p>
        ) : (
          <ul className="flex flex-col p-2">
            <li>
              <PatientButton
                active={patientId === null}
                onClick={() => selectPatient(null)}
                title="Wszyscy pacjenci"
                subtitle={`${totalReports} ${plural(totalReports, "raport", "raporty", "raportów")}`}
              />
            </li>
            {filteredPatients.map((patient) => (
              <li key={patient.id}>
                <PatientButton
                  active={patientId === patient.id}
                  onClick={() => selectPatient(patient.id)}
                  title={`${patient.first_name} ${patient.last_name}`}
                  subtitle={
                    patient.reports_count === 0
                      ? "brak raportów"
                      : `${patient.reports_count} ${plural(patient.reports_count, "raport", "raporty", "raportów")}${
                          patient.last_report_at
                            ? ` · ost. ${new Date(patient.last_report_at).toLocaleDateString("pl-PL")}`
                            : ""
                        }`
                  }
                />
              </li>
            ))}
            {filteredPatients.length === 0 ? (
              <li className="px-3 py-2 text-sm text-zinc-500">
                Brak pacjentów.
              </li>
            ) : null}
          </ul>
        )}
      </aside>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white p-5">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">
              {selectedPatient
                ? `${selectedPatient.first_name} ${selectedPatient.last_name}`
                : "Wszystkie raporty"}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              {selectedPatient
                ? "Raporty z wizyt i dokumentacja zmian skórnych pacjenta."
                : "Wybierz pacjenta z listy, aby dodać nowy raport."}
            </p>
          </div>
          {selectedPatient ? (
            <button
              type="button"
              onClick={openNewReport}
              className="rounded-md bg-violet-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-600"
            >
              + Nowy raport
            </button>
          ) : null}
        </div>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {reports === null ? (
          <p className="text-sm text-zinc-500">Ładowanie raportów…</p>
        ) : reports.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-6 py-10 text-center">
            <p className="text-sm text-zinc-600">
              {selectedPatient
                ? "Ten pacjent nie ma jeszcze raportów. Kliknij „Nowy raport”, aby zacząć dokumentację."
                : "Brak raportów. Wybierz pacjenta i dodaj pierwszy raport."}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {reports.map((report) => (
              <li key={report.id}>
                <button
                  type="button"
                  onClick={() => openReport(report)}
                  className="flex w-full items-start justify-between gap-4 rounded-lg border border-zinc-200 bg-white p-5 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-zinc-900 first-letter:uppercase">
                      {formatDate(report.created_at)}
                      <span className="ml-2 font-normal text-zinc-500">
                        {formatTime(report.created_at)}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {patientId === null
                        ? `${report.patient.first_name} ${report.patient.last_name}`
                        : null}
                      {patientId === null && report.doctor_name ? " · " : null}
                      {report.doctor_name ?? null}
                    </span>
                    <span className="mt-2 line-clamp-2 block text-sm text-zinc-600">
                      {report.notes || "Brak notatki."}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-2">
                    {report.photos_count > 0 ? (
                      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                        {report.photos_count}{" "}
                        {plural(report.photos_count, "zdjęcie", "zdjęcia", "zdjęć")}
                      </span>
                    ) : null}
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                      {report.findings_count}{" "}
                      {plural(report.findings_count, "zmiana", "zmiany", "zmian")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PatientButton({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-md px-3 py-2.5 text-left transition-colors ${
        active ? "bg-zinc-100" : "hover:bg-zinc-50"
      }`}
    >
      <span
        className={`block text-sm ${
          active ? "font-semibold text-zinc-900" : "font-medium text-zinc-800"
        }`}
      >
        {title}
      </span>
      <span className="mt-0.5 block text-xs text-zinc-500">{subtitle}</span>
    </button>
  );
}
