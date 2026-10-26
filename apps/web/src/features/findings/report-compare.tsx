"use client";

import { useEffect, useState } from "react";

import { useAuth, useAuthorizedFetch } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/format";
import type {
  BodySide,
  MedicalReport,
  PatientSummary,
  ReportPhoto,
  SkinFinding,
} from "@/lib/types";

import BodyMap from "./body-map";
import { bodyPartLabel } from "./body-parts";
import { PhotoLightbox } from "./photo-lightbox";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function ReportCompare({
  patient,
  reportIds,
  onBack,
}: {
  patient: PatientSummary;
  reportIds: [number, number];
  onBack: () => void;
}) {
  const authorizedFetch = useAuthorizedFetch();
  const [reports, setReports] = useState<MedicalReport[] | null>(null);
  const [side, setSide] = useState<BodySide>("front");
  const [selected, setSelected] = useState<{
    reportId: number;
    findingId: number;
  } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all(
      reportIds.map((id) => authorizedFetch<MedicalReport>(`/reports/${id}`)),
    )
      .then((data) => {
        if (!active) return;
        const sorted = [...data].sort((a, b) =>
          a.created_at.localeCompare(b.created_at),
        );
        setReports(sorted);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Nie udało się pobrać raportów do porównania.",
        );
      });
    return () => {
      active = false;
    };
  }, [authorizedFetch, reportIds]);

  const handleFindingClick = (reportId: number, finding: SkinFinding) => {
    setSelected({ reportId, findingId: finding.id });
    setSide(finding.side);
  };

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <BackButton onBack={onBack} />
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      </div>
    );
  }

  if (!reports) {
    return <p className="text-sm text-zinc-500">Ładowanie porównania…</p>;
  }

  const [older, newer] = reports;
  const findingsDelta = newer.findings.length - older.findings.length;
  const photosDelta = newer.photos.length - older.photos.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <BackButton onBack={onBack} />
          <h2 className="mt-2 text-2xl font-semibold text-zinc-900">
            Porównanie dokumentacji
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            {patient.first_name} {patient.last_name} ·{" "}
            <span className="first-letter:uppercase">
              {formatDate(older.created_at)}
            </span>{" "}
            →{" "}
            <span className="first-letter:uppercase">
              {formatDate(newer.created_at)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 self-center">
          <span className="text-sm font-medium text-zinc-600">Widok:</span>
          <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 text-sm font-medium">
            {(
              [
                { id: "front", label: "Przód" },
                { id: "back", label: "Tył" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSide(item.id)}
                className={`rounded-md px-4 py-1.5 transition-colors ${
                  side === item.id
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-violet-200 bg-violet-50 px-5 py-3 text-sm text-violet-900">
        <span>
          Zmiany skórne: <strong>{older.findings.length}</strong> →{" "}
          <strong>{newer.findings.length}</strong> (
          {findingsDelta > 0 ? `+${findingsDelta}` : findingsDelta})
        </span>
        <span>
          Zdjęcia: <strong>{older.photos.length}</strong> →{" "}
          <strong>{newer.photos.length}</strong> (
          {photosDelta > 0 ? `+${photosDelta}` : photosDelta})
        </span>
        {older.body_figure !== newer.body_figure ? (
          <span className="font-medium">
            Uwaga: raporty mają różne sylwetki (
            {older.body_figure === "female" ? "kobieta" : "mężczyzna"} vs{" "}
            {newer.body_figure === "female" ? "kobieta" : "mężczyzna"}).
          </span>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {reports.map((report, index) => (
          <ComparePanel
            key={report.id}
            report={report}
            label={index === 0 ? "Wcześniejszy" : "Późniejszy"}
            side={side}
            selectedFindingId={
              selected?.reportId === report.id ? selected.findingId : null
            }
            onFindingClick={(finding) => handleFindingClick(report.id, finding)}
            onPhotoOpen={setPreviewUrl}
          />
        ))}
      </div>

      {previewUrl ? (
        <PhotoLightbox url={previewUrl} onClose={() => setPreviewUrl(null)} />
      ) : null}
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
    >
      ← Lista raportów
    </button>
  );
}

function ComparePanel({
  report,
  label,
  side,
  selectedFindingId,
  onFindingClick,
  onPhotoOpen,
}: {
  report: MedicalReport;
  label: string;
  side: BodySide;
  selectedFindingId: number | null;
  onFindingClick: (finding: SkinFinding) => void;
  onPhotoOpen: (url: string) => void;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-5 rounded-lg border border-zinc-200 bg-white p-5">
      <header>
        <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800">
          {label}
        </span>
        <h3 className="mt-2 text-lg font-semibold text-zinc-900 first-letter:uppercase">
          {formatDate(report.created_at)}
          <span className="ml-2 text-sm font-normal text-zinc-500">
            {formatTime(report.created_at)}
          </span>
        </h3>
        <p className="mt-0.5 text-sm text-zinc-600">
          {report.doctor_name ?? "—"} · sylwetka:{" "}
          {report.body_figure === "female" ? "kobieta" : "mężczyzna"}
        </p>
      </header>

      <BodyMap
        side={side}
        figure={report.body_figure}
        findings={report.findings}
        selectedId={selectedFindingId}
        addingMode={false}
        pendingPoint={null}
        paintMode={false}
        paintColor="#dc2626"
        brushRadius={10}
        pendingStrokes={[]}
        partMode={false}
        pendingPart={null}
        onMapClick={() => undefined}
        onMarkerClick={onFindingClick}
        onPaintStroke={() => undefined}
        onPartClick={() => undefined}
      />

      <div>
        <h4 className="text-sm font-semibold text-zinc-900">
          Zmiany skórne ({report.findings.length})
        </h4>
        {report.findings.length === 0 ? (
          <p className="mt-1.5 text-sm text-zinc-500">
            Brak zmian w tym raporcie.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-100 rounded-md border border-zinc-200">
            {report.findings.map((finding) => {
              const isSelected = finding.id === selectedFindingId;
              return (
                <li key={finding.id}>
                  <button
                    type="button"
                    onClick={() => onFindingClick(finding)}
                    className={`flex w-full items-start gap-3 px-3.5 py-2.5 text-left transition-colors ${
                      isSelected ? "bg-violet-50" : "hover:bg-zinc-50"
                    }`}
                  >
                    <span
                      className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border border-white shadow"
                      style={{ backgroundColor: finding.color }}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-zinc-900">
                        {finding.finding_type}
                        {finding.geometry.kind === "part" ? (
                          <span className="ml-2 text-xs font-medium text-violet-700">
                            {bodyPartLabel(finding.geometry.part)}
                          </span>
                        ) : null}
                        <span className="ml-2 text-xs font-normal text-zinc-500">
                          {finding.side === "front" ? "przód" : "tył"}
                        </span>
                      </span>
                      {finding.description ? (
                        <span className="mt-0.5 block text-sm text-zinc-600">
                          {finding.description}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-zinc-900">
          Notatka lekarska
        </h4>
        <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-zinc-700">
          {report.notes || "Brak notatki."}
        </p>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-zinc-900">
          Zdjęcia ({report.photos.length})
        </h4>
        {report.photos.length === 0 ? (
          <p className="mt-1.5 text-sm text-zinc-500">Brak zdjęć.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-3">
            {report.photos.map((photo) => (
              <ComparePhotoThumb
                key={photo.id}
                reportId={report.id}
                photo={photo}
                onOpen={onPhotoOpen}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ComparePhotoThumb({
  reportId,
  photo,
  onOpen,
}: {
  reportId: number;
  photo: ReportPhoto;
  onOpen: (url: string) => void;
}) {
  const { token } = useAuth();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    fetch(`${API_URL}/reports/${reportId}/photos/${photo.id}`, {
      headers: { Authorization: `Bearer ${token ?? ""}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("http");
        const blob = await response.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [reportId, photo.id, token]);

  if (!url) {
    return (
      <div className="h-24 w-24 animate-pulse rounded-md border border-zinc-200 bg-zinc-100" />
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(url)}
      title="Powiększ zdjęcie"
      className="block cursor-zoom-in"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Zdjęcie do raportu"
        className="h-24 w-24 rounded-md border border-zinc-200 object-cover"
      />
    </button>
  );
}
