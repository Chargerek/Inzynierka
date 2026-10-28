"use client";

import { useEffect, useRef, useState } from "react";

import { useAuthorizedFetch } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/format";
import type {
  AreaStroke,
  BodyFigure,
  BodySide,
  FindingGeometry,
  MedicalReport,
  PatientSummary,
  SkinFinding,
} from "@/lib/types";

import BodyMap from "./body-map";
import { bodyPartLabel } from "./body-parts";
import { FindingPhotos } from "./finding-photos";
import { ReportPhotos } from "./report-photos";

const FINDING_TYPES = ["znamię", "wykwit", "brodawka", "blizna", "inne"];

const COLOR_PRESETS = [
  { value: "#dc2626", label: "czerwony" },
  { value: "#7c3aed", label: "fioletowy" },
  { value: "#92400e", label: "brązowy" },
  { value: "#1d4ed8", label: "niebieski" },
  { value: "#18181b", label: "czarny" },
];

type FindingFormState = {
  finding_type: string;
  color: string;
  description: string;
};

const EMPTY_FORM: FindingFormState = {
  finding_type: FINDING_TYPES[0],
  color: COLOR_PRESETS[0].value,
  description: "",
};

const BRUSH_SIZES = [
  { radius: 5, label: "S" },
  { radius: 10, label: "M" },
  { radius: 18, label: "L" },
];

type ReportEditorProps = {
  patient: PatientSummary;
  reportId: number | null;
  initialFigure: BodyFigure;
  onBack: () => void;
};

export function ReportEditor({
  patient,
  reportId,
  initialFigure,
  onBack,
}: ReportEditorProps) {
  const authorizedFetch = useAuthorizedFetch();
  const [report, setReport] = useState<MedicalReport | null>(null);
  const [loading, setLoading] = useState(reportId !== null);
  const [notes, setNotes] = useState("");
  const [figure, setFigure] = useState<BodyFigure>(initialFigure);
  const [side, setSide] = useState<BodySide>("front");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addingMode, setAddingMode] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [drawTool, setDrawTool] = useState<"point" | "brush" | "part">("point");
  const [brushRadius, setBrushRadius] = useState(BRUSH_SIZES[1].radius);
  const [pendingStrokes, setPendingStrokes] = useState<AreaStroke[]>([]);
  const [pendingPart, setPendingPart] = useState<string | null>(null);
  const [form, setForm] = useState<FindingFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (reportId === null) return;
    let active = true;
    authorizedFetch<MedicalReport>(`/reports/${reportId}`)
      .then((data) => {
        if (!active) return;
        setReport(data);
        setNotes(data.notes);
        setFigure(data.body_figure);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Nie udało się pobrać raportu.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authorizedFetch, reportId]);

  const findings = report?.findings ?? [];
  const notesDirty = notes !== (report?.notes ?? "");

  const reloadReport = async (id: number) => {
    try {
      const data = await authorizedFetch<MedicalReport>(`/reports/${id}`);
      setReport(data);
    } catch {
      setError("Nie udało się odświeżyć raportu.");
    }
  };

  const ensureReport = async (): Promise<number> => {
    if (report) return report.id;
    const created = await authorizedFetch<MedicalReport>("/reports", {
      method: "POST",
      body: { patient_id: patient.id, body_figure: figure, notes },
    });
    setReport(created);
    return created.id;
  };

  const resetEditor = () => {
    setAddingMode(false);
    setPendingPoint(null);
    setPendingStrokes([]);
    setPendingPart(null);
    setDrawTool("point");
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleFigureChange = async (value: BodyFigure) => {
    setFigure(value);
    if (!report) return;
    try {
      const updated = await authorizedFetch<MedicalReport>(
        `/reports/${report.id}`,
        { method: "PUT", body: { body_figure: value } },
      );
      setReport(updated);
    } catch {
      setError("Nie udało się zapisać wyboru sylwetki.");
    }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    setError(null);
    setNotice(null);
    try {
      if (report) {
        const updated = await authorizedFetch<MedicalReport>(
          `/reports/${report.id}`,
          { method: "PUT", body: { notes } },
        );
        setReport(updated);
      } else {
        await ensureReport();
      }
      setNotice("Raport został zapisany.");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Nie udało się zapisać raportu.",
      );
    } finally {
      setSavingNotes(false);
    }
  };

  const handleDeleteReport = async () => {
    if (!report) {
      onBack();
      return;
    }
    if (!window.confirm("Usunąć cały raport wraz ze zmianami i zdjęciami?")) {
      return;
    }
    try {
      await authorizedFetch(`/reports/${report.id}`, { method: "DELETE" });
      onBack();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Nie udało się usunąć raportu.",
      );
    }
  };

  const handleMarkerClick = (finding: SkinFinding) => {
    if (finding.id === selectedId) {
      setSelectedId(null);
      resetEditor();
      return;
    }
    setSelectedId(finding.id);
    setEditingId(finding.id);
    setAddingMode(false);
    setPendingPoint(null);
    setSide(finding.side as BodySide);
    setForm({
      finding_type: finding.finding_type,
      color: finding.color,
      description: finding.description,
    });
  };

  const handleStartAdding = () => {
    resetEditor();
    setSelectedId(null);
    setNotice(null);
    setAddingMode(true);
  };

  const handleSaveNew = async () => {
    const geometry: FindingGeometry | null =
      drawTool === "brush"
        ? pendingStrokes.length > 0
          ? { kind: "area", strokes: pendingStrokes }
          : null
        : drawTool === "part"
          ? pendingPart
            ? { kind: "part", part: pendingPart }
            : null
          : pendingPoint
            ? { kind: "marker", x: pendingPoint.x, y: pendingPoint.y }
            : null;
    if (!geometry) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const id = await ensureReport();
      const created = await authorizedFetch<SkinFinding>("/findings", {
        method: "POST",
        body: {
          report_id: id,
          side,
          geometry,
          color: form.color,
          finding_type: form.finding_type,
          description: form.description,
        },
      });
      await reloadReport(id);
      resetEditor();
      setSelectedId(created.id);
      setNotice("Zmiana została zapisana.");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Nie udało się zapisać zmiany.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (editingId === null || !report) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await authorizedFetch<SkinFinding>(`/findings/${editingId}`, {
        method: "PUT",
        body: {
          color: form.color,
          finding_type: form.finding_type,
          description: form.description,
        },
      });
      await reloadReport(report.id);
      setNotice("Zmiana została zaktualizowana.");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Nie udało się zapisać zmiany.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFinding = async (finding: SkinFinding) => {
    if (!report) return;
    if (!window.confirm("Usunąć tę zmianę wraz ze zdjęciami?")) return;
    setError(null);
    setNotice(null);
    try {
      await authorizedFetch(`/findings/${finding.id}`, { method: "DELETE" });
      if (selectedId === finding.id) setSelectedId(null);
      if (editingId === finding.id) resetEditor();
      await reloadReport(report.id);
      setNotice("Zmiana została usunięta.");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Nie udało się usunąć zmiany.",
      );
    }
  };

  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (selectedId === null) return;
    listRef.current
      ?.querySelector(`[data-finding-id="${selectedId}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  if (loading) {
    return <p className="text-sm text-zinc-500">Ładowanie raportu…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
          >
            ← Lista raportów
          </button>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-900">
            {report
              ? `Raport z ${formatDate(report.created_at)}`
              : "Nowy raport"}
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            {patient.first_name} {patient.last_name}
            {report
              ? ` · godz. ${formatTime(report.created_at)}${
                  report.doctor_name ? ` · ${report.doctor_name}` : ""
                }`
              : " · raport zostanie utworzony przy pierwszym zapisie"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDeleteReport}
          className="rounded-md px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          {report ? "Usuń raport" : "Odrzuć"}
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              value={side}
              onChange={(value) => {
                setSide(value);
                setPendingPoint(null);
                setPendingStrokes([]);
                setPendingPart(null);
              }}
              options={[
                { id: "front", label: "Przód" },
                { id: "back", label: "Tył" },
              ]}
            />
            <SegmentedControl
              value={figure}
              onChange={(value) => void handleFigureChange(value)}
              options={[
                { id: "female", label: "Kobieta" },
                { id: "male", label: "Mężczyzna" },
              ]}
            />
          </div>

          {addingMode ? (
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                value={drawTool}
                onChange={(value) => {
                  setDrawTool(value);
                  setPendingPoint(null);
                  setPendingStrokes([]);
                  setPendingPart(null);
                }}
                options={[
                  { id: "point", label: "Punkt" },
                  { id: "brush", label: "Obszar" },
                  { id: "part", label: "Część ciała" },
                ]}
              />
              {drawTool === "brush" ? (
                <>
                  <SegmentedControl
                    value={String(brushRadius)}
                    onChange={(value) => setBrushRadius(Number(value))}
                    options={BRUSH_SIZES.map((size) => ({
                      id: String(size.radius),
                      label: size.label,
                    }))}
                  />
                  {pendingStrokes.length > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setPendingStrokes((strokes) => strokes.slice(0, -1))
                      }
                      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
                    >
                      Cofnij kreskę
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          <BodyMap
            side={side}
            figure={figure}
            findings={findings}
            selectedId={selectedId}
            addingMode={addingMode}
            pendingPoint={
              pendingPoint && drawTool === "point"
                ? { ...pendingPoint, color: form.color }
                : null
            }
            paintMode={addingMode && drawTool === "brush"}
            paintColor={form.color}
            brushRadius={brushRadius}
            pendingStrokes={pendingStrokes.map((stroke) => ({
              ...stroke,
              color: form.color,
            }))}
            partMode={addingMode && drawTool === "part"}
            pendingPart={pendingPart}
            onMapClick={(x, y) => setPendingPoint({ x, y })}
            onMarkerClick={handleMarkerClick}
            onPaintStroke={(stroke) =>
              setPendingStrokes((strokes) => [...strokes, stroke])
            }
            onPartClick={(partId) => setPendingPart(partId)}
          />
          <p className="text-xs text-zinc-400">
            Przeciągnij, aby przesunąć mapę. Kółko myszy lub dwa palce —
            powiększenie.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <label
              htmlFor="report-notes"
              className="text-base font-semibold text-zinc-900"
            >
              Notatka lekarska
            </label>
            <textarea
              id="report-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={6}
              placeholder="Wywiad, badanie, rozpoznanie, zalecenia…"
              className="mt-3 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm leading-6 text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
            <div className="mt-3 flex items-center justify-end gap-3">
              {report && !notesDirty ? (
                <span className="text-xs text-zinc-400">Zapisano</span>
              ) : null}
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={savingNotes || (report !== null && !notesDirty)}
                className="rounded-md bg-violet-700 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingNotes ? "Zapisywanie…" : "Zapisz raport"}
              </button>
            </div>
          </div>

          <ReportPhotos
            reportId={report?.id ?? null}
            photos={report?.photos ?? []}
            ensureReport={ensureReport}
            onChanged={reloadReport}
          />

          <div className="rounded-lg border border-zinc-200 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
              <h3 className="text-base font-semibold text-zinc-900">
                Zmiany skórne ({findings.length})
              </h3>
              <button
                type="button"
                onClick={handleStartAdding}
                disabled={addingMode}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                + Dodaj zmianę
              </button>
            </div>

            {addingMode ? (
              <FindingForm
                title="Nowa zmiana skórna"
                hint={
                  drawTool === "brush"
                    ? pendingStrokes.length > 0
                      ? `Obszar pomalowany (${side === "front" ? "przód" : "tył"}). Uzupełnij dane poniżej.`
                      : "Przeciągnij po sylwetce, aby pomalować obszar zmiany."
                    : drawTool === "part"
                      ? pendingPart
                        ? `Zaznaczono: ${bodyPartLabel(pendingPart)} (${side === "front" ? "przód" : "tył"}). Uzupełnij dane poniżej.`
                        : "Kliknij część ciała na sylwetce."
                      : pendingPoint
                        ? `Punkt zaznaczony (${side === "front" ? "przód" : "tył"}). Uzupełnij dane poniżej.`
                        : "Kliknij na sylwetkę miejsce zmiany."
                }
                form={form}
                onChange={setForm}
                onCancel={resetEditor}
                onSave={handleSaveNew}
                saveDisabled={
                  saving ||
                  (drawTool === "point" && !pendingPoint) ||
                  (drawTool === "brush" && pendingStrokes.length === 0) ||
                  (drawTool === "part" && !pendingPart)
                }
                saving={saving}
              />
            ) : null}

            {findings.length === 0 ? (
              <p className="px-5 py-4 text-sm text-zinc-500">
                Brak zmian w tym raporcie. Kliknij „Dodaj zmianę” i zaznacz
                miejsce na sylwetce.
              </p>
            ) : (
              <ul ref={listRef} className="divide-y divide-zinc-100">
                {findings.map((finding) => {
                  const isSelected = finding.id === selectedId;
                  return (
                    <li key={finding.id} data-finding-id={finding.id}>
                      <div
                        className={`flex items-start gap-3 px-5 py-4 transition-colors ${
                          isSelected ? "bg-violet-50" : "hover:bg-zinc-50"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleMarkerClick(finding)}
                          aria-expanded={isSelected}
                          title={
                            isSelected ? "Zwiń zmianę" : "Rozwiń zmianę"
                          }
                          className="flex min-w-0 flex-1 items-start gap-3 text-left"
                        >
                          <svg
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className={`mt-0.5 h-4 w-4 shrink-0 text-zinc-400 transition-transform ${
                              isSelected ? "rotate-90" : ""
                            }`}
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M7.21 14.77a.75.75 0 01.02-1.06L11.17 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span
                            className="mt-1 h-4 w-4 shrink-0 rounded-full border border-white shadow"
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
                              {finding.photos.length > 0 ? (
                                <span className="ml-2 text-xs font-normal text-zinc-500">
                                  {photosLabel(finding.photos.length)}
                                </span>
                              ) : null}
                            </span>
                            {finding.description ? (
                              <span className="mt-0.5 block truncate text-sm text-zinc-600">
                                {finding.description}
                              </span>
                            ) : null}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFinding(finding)}
                          className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                        >
                          Usuń
                        </button>
                      </div>
                      {isSelected && report ? (
                        <div>
                          <FindingForm
                            title="Edytuj zmianę"
                            hint={null}
                            form={form}
                            onChange={setForm}
                            onCancel={() => {
                              resetEditor();
                              setSelectedId(null);
                            }}
                            onSave={handleSaveEdit}
                            saveDisabled={saving}
                            saving={saving}
                          />
                          <FindingPhotos
                            key={finding.id}
                            finding={finding}
                            onChanged={() => reloadReport(report.id)}
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function photosLabel(count: number): string {
  if (count === 1) return "1 zdjęcie";
  const tens = count % 10;
  const hundreds = count % 100;
  if (tens >= 2 && tens <= 4 && (hundreds < 12 || hundreds > 14)) {
    return `${count} zdjęcia`;
  }
  return `${count} zdjęć`;
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 text-sm font-medium">
      {options.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`rounded-md px-4 py-1.5 transition-colors ${
            value === item.id
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function FindingForm({
  title,
  hint,
  form,
  onChange,
  onCancel,
  onSave,
  saveDisabled,
  saving,
}: {
  title: string;
  hint: string | null;
  form: FindingFormState;
  onChange: (updater: (current: FindingFormState) => FindingFormState) => void;
  onCancel: () => void;
  onSave: () => void;
  saveDisabled: boolean;
  saving: boolean;
}) {
  return (
    <div className="border-b border-zinc-100 bg-zinc-50 px-5 py-4">
      <h4 className="text-sm font-semibold text-zinc-900">{title}</h4>
      {hint ? <p className="mt-1 text-sm text-zinc-600">{hint}</p> : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="finding-type"
            className="text-sm font-medium text-zinc-900"
          >
            Typ zmiany
          </label>
          <select
            id="finding-type"
            value={form.finding_type}
            onChange={(event) =>
              onChange((f) => ({ ...f, finding_type: event.target.value }))
            }
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
          >
            {FINDING_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-900">Kolor</span>
          <div className="flex items-center gap-2 py-1">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                title={preset.label}
                onClick={() => onChange((f) => ({ ...f, color: preset.value }))}
                className={`h-7 w-7 rounded-full border-2 transition-transform ${
                  form.color === preset.value
                    ? "scale-110 border-zinc-900"
                    : "border-white shadow"
                }`}
                style={{ backgroundColor: preset.value }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <label
          htmlFor="finding-description"
          className="text-sm font-medium text-zinc-900"
        >
          Opis
        </label>
        <textarea
          id="finding-description"
          value={form.description}
          onChange={(event) =>
            onChange((f) => ({ ...f, description: event.target.value }))
          }
          rows={2}
          placeholder="np. znamię ok. 4 mm, bez cech atypowych"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
        />
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
        >
          Anuluj
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saveDisabled}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Zapisywanie…" : "Zapisz zmianę"}
        </button>
      </div>
    </div>
  );
}
