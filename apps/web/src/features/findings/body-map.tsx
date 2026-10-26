"use client";

import dynamic from "next/dynamic";
import type { AreaStroke, BodyFigure, BodySide, SkinFinding } from "@/lib/types";

export type PendingStroke = AreaStroke & { color: string };

export type BodyMapProps = {
  side: BodySide;
  figure: BodyFigure;
  findings: SkinFinding[];
  selectedId: number | null;
  addingMode: boolean;
  pendingPoint: { x: number; y: number; color: string } | null;
  paintMode: boolean;
  paintColor: string;
  brushRadius: number;
  pendingStrokes: PendingStroke[];
  partMode: boolean;
  pendingPart: string | null;
  onMapClick: (x: number, y: number) => void;
  onMarkerClick: (finding: SkinFinding) => void;
  onPaintStroke: (stroke: AreaStroke) => void;
  onPartClick: (partId: string) => void;
};

const BodyMapCanvas = dynamic(() => import("./body-map-canvas"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full animate-pulse rounded-xl border border-zinc-200 bg-zinc-100"
      style={{ aspectRatio: "400 / 900" }}
    />
  ),
});

export default function BodyMap(props: BodyMapProps) {
  return <BodyMapCanvas {...props} />;
}
