"use client";

import { useEffect, useRef, useState } from "react";

import { useAuth, useAuthorizedFetch } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api";
import type { ReportPhoto } from "@/lib/types";

import { PhotoLightbox } from "./photo-lightbox";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function ReportPhotos({
  reportId,
  photos,
  ensureReport,
  onChanged,
}: {
  reportId: number | null;
  photos: ReportPhoto[];
  ensureReport: () => Promise<number>;
  onChanged: (reportId: number) => Promise<void>;
}) {
  const authorizedFetch = useAuthorizedFetch();
  const { token } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const id = await ensureReport();
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${API_URL}/reports/${id}/photos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
        body: formData,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          detail?: string;
        } | null;
        throw new Error(payload?.detail ?? "Nie udało się wgrać zdjęcia.");
      }
      await onChanged(id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Nie udało się wgrać zdjęcia.",
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (photoId: number) => {
    if (reportId === null) return;
    setError(null);
    try {
      await authorizedFetch(`/reports/${reportId}/photos/${photoId}`, {
        method: "DELETE",
      });
      await onChanged(reportId);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Nie udało się usunąć zdjęcia.",
      );
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-semibold text-zinc-900">
          Zdjęcia do raportu ({photos.length})
        </p>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUpload(file);
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="shrink-0 whitespace-nowrap rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? "Wgrywanie…" : "Dodaj zdjęcie"}
          </button>
        </div>
      </div>
      {error ? (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {photos.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {photos.map((photo) => (
            <ReportPhotoThumb
              key={photo.id}
              reportId={reportId}
              photo={photo}
              onOpen={setPreviewUrl}
              onDelete={() => handleDelete(photo.id)}
            />
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">
          Brak zdjęć. Możesz dodać np. zdjęcie ogólne z wizyty — nie jest
          przypisane do konkretnej zmiany na mapie.
        </p>
      )}
      {previewUrl ? (
        <PhotoLightbox url={previewUrl} onClose={() => setPreviewUrl(null)} />
      ) : null}
    </div>
  );
}

function ReportPhotoThumb({
  reportId,
  photo,
  onOpen,
  onDelete,
}: {
  reportId: number | null;
  photo: ReportPhoto;
  onOpen: (url: string) => void;
  onDelete: () => void;
}) {
  const { token } = useAuth();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (reportId === null) return;
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

  return (
    <div className="group relative">
      {url ? (
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
      ) : (
        <div className="h-24 w-24 animate-pulse rounded-md border border-zinc-200 bg-zinc-100" />
      )}
      <button
        type="button"
        onClick={onDelete}
        title="Usuń zdjęcie"
        className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white shadow group-hover:flex"
      >
        ×
      </button>
    </div>
  );
}
