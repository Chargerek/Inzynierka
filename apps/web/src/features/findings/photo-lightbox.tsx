"use client";

import { useEffect } from "react";

export function PhotoLightbox({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Podgląd zdjęcia"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Zdjęcie w pełnym rozmiarze"
        onClick={onClose}
        className="max-h-full max-w-full cursor-zoom-out rounded-md object-contain"
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Zamknij podgląd"
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl text-white transition-colors hover:bg-white/25"
      >
        ×
      </button>
    </div>
  );
}
