import type { BodyFigure, BodySide } from "@/lib/types";

import { BODY_PART_ZONES } from "./body-part-zones";

type LimbBase = "upper_arm" | "forearm" | "hand" | "thigh" | "shin" | "foot";

// polskie nazwy: [forma dla "left", forma dla "right"]
const LIMB_LABELS: Record<LimbBase, [string, string]> = {
  upper_arm: ["lewe ramię", "prawe ramię"],
  forearm: ["lewe przedramię", "prawe przedramię"],
  hand: ["lewa dłoń", "prawa dłoń"],
  thigh: ["lewe udo", "prawe udo"],
  shin: ["lewa goleń", "prawa goleń"],
  foot: ["lewa stopa", "prawa stopa"],
};

const TORSO_LABELS: Record<string, string> = {
  head: "głowa",
  neck: "szyja",
  chest: "klatka piersiowa",
  abdomen: "brzuch",
  pelvis: "miednica",
  upper_back: "górna część pleców",
  lower_back: "dolna część pleców",
  buttocks: "pośladki",
};

const TORSO_PARTS: Record<BodySide, string[]> = {
  front: ["head", "neck", "chest", "abdomen", "pelvis"],
  back: ["head", "neck", "upper_back", "lower_back", "buttocks"],
};

// kolejność sprawdzania przy kliknięciu (od najmniejszych obszarów)
const HIT_ORDER: string[] = [
  "hand",
  "foot",
  "forearm",
  "shin",
  "upper_arm",
  "thigh",
  "head",
  "neck",
  "chest",
  "abdomen",
  "pelvis",
  "upper_back",
  "lower_back",
  "buttocks",
];

const LIMB_RE = /^(left|right)_(upper_arm|forearm|hand|thigh|shin|foot)$/;

// cache ramek otaczających: [minX, minY, maxX, maxX]
const bboxCache = new Map<string, [number, number, number, number]>();

function bbox(points: readonly number[]): [number, number, number, number] {
  let box = bboxCache.get(points as number[] as never);
  if (box) return box;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    minX = Math.min(minX, points[i]);
    maxX = Math.max(maxX, points[i]);
    minY = Math.min(minY, points[i + 1]);
    maxY = Math.max(maxY, points[i + 1]);
  }
  box = [minX, minY, maxX, maxY];
  bboxCache.set(points as number[] as never, box);
  return box;
}

// rzut promienia (ray casting)
function pointInPolygon(
  points: readonly number[],
  x: number,
  y: number,
): boolean {
  const [minX, minY, maxX, maxY] = bbox(points);
  if (x < minX || x > maxX || y < minY || y > maxY) return false;
  let inside = false;
  for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
    const xi = points[i];
    const yi = points[i + 1];
    const xj = points[j];
    const yj = points[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function bodyPartPolygon(
  figure: BodyFigure,
  side: BodySide,
  partId: string,
): readonly number[] | null {
  return BODY_PART_ZONES[figure][side][partId] ?? null;
}

export function bodyPartLabel(partId: string): string {
  if (partId in TORSO_LABELS) return TORSO_LABELS[partId];
  const match = LIMB_RE.exec(partId);
  if (!match) return partId;
  const labels = LIMB_LABELS[match[2] as LimbBase];
  return match[1] === "left" ? labels[0] : labels[1];
}

export function hitTestBodyPart(
  figure: BodyFigure,
  side: BodySide,
  x: number,
  y: number,
): string | null {
  const zones = BODY_PART_ZONES[figure][side];
  const torso = new Set(TORSO_PARTS[side]);
  for (const base of HIT_ORDER) {
    if (torso.has(base)) {
      const poly = zones[base];
      if (poly && pointInPolygon(poly, x, y)) return base;
      continue;
    }
    for (const prefix of ["left", "right"]) {
      const id = `${prefix}_${base}`;
      const poly = zones[id];
      if (poly && pointInPolygon(poly, x, y)) return id;
    }
  }
  return null;
}
