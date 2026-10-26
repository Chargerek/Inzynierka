"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, Group, Layer, Line, Stage } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";

import { bodyPartPolygon, hitTestBodyPart } from "./body-parts";
import type { BodyMapProps } from "./body-map";

export const BODY_VIEWBOX_WIDTH = 400;
export const BODY_VIEWBOX_HEIGHT = 900;

const MAX_ZOOM = 6;
const MIN_MAP_HEIGHT = 420;
const VIEWPORT_MARGIN = 140;
const MAX_FRONT_STROKE_POINTS = 2000;

type BodyMapCanvasProps = BodyMapProps;

type ViewTransform = {
  scale: number;
  x: number;
  y: number;
};

type MapSize = {
  width: number;
  height: number;
  fitScale: number;
};

function clampAxis(offset: number, stage: number, content: number) {
  if (content <= stage) return (stage - content) / 2;
  return Math.max(stage - content, Math.min(0, offset));
}

function clampTransform(t: ViewTransform, size: MapSize): ViewTransform {
  const scale = Math.min(
    size.fitScale * MAX_ZOOM,
    Math.max(size.fitScale, t.scale),
  );
  return {
    scale,
    x: clampAxis(t.x, size.width, BODY_VIEWBOX_WIDTH * scale),
    y: clampAxis(t.y, size.height, BODY_VIEWBOX_HEIGHT * scale),
  };
}

function fitTransform(size: MapSize): ViewTransform {
  return clampTransform({ scale: size.fitScale, x: 0, y: 0 }, size);
}

export default function BodyMapCanvas({
  side,
  figure,
  findings,
  selectedId,
  addingMode,
  pendingPoint,
  paintMode,
  paintColor,
  brushRadius,
  pendingStrokes,
  partMode,
  pendingPart,
  onMapClick,
  onMarkerClick,
  onPaintStroke,
  onPartClick,
}: BodyMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [size, setSize] = useState<MapSize>({ width: 0, height: 0, fitScale: 1 });
  const [transform, setTransform] = useState<ViewTransform>({ scale: 1, x: 0, y: 0 });
  const [currentStroke, setCurrentStroke] = useState<number[] | null>(null);
  const [brushPos, setBrushPos] = useState<{ x: number; y: number } | null>(null);
  const [hoverPart, setHoverPart] = useState<string | null>(null);
  const dragDistance = useRef(0);
  const lastTouchDistance = useRef<number | null>(null);
  const painting = useRef(false);
  const strokePoints = useRef<number[] | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const width = container.clientWidth;
      if (width === 0) return;
      const naturalHeight = (width * BODY_VIEWBOX_HEIGHT) / BODY_VIEWBOX_WIDTH;
      const height = Math.min(
        naturalHeight,
        Math.max(MIN_MAP_HEIGHT, window.innerHeight - VIEWPORT_MARGIN),
      );
      const fitScale = Math.min(
        width / BODY_VIEWBOX_WIDTH,
        height / BODY_VIEWBOX_HEIGHT,
      );
      const next = { width, height, fitScale };
      setSize(next);
      setTransform(fitTransform(next));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const zoomAround = useCallback(
    (pointX: number, pointY: number, factor: number) => {
      setTransform((prev) => {
        const worldX = (pointX - prev.x) / prev.scale;
        const worldY = (pointY - prev.y) / prev.scale;
        const scale = prev.scale * factor;
        return clampTransform(
          { scale, x: pointX - worldX * scale, y: pointY - worldY * scale },
          size,
        );
      });
    },
    [size],
  );

  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const pointer = stageRef.current?.getPointerPosition();
      if (!pointer) return;
      zoomAround(pointer.x, pointer.y, e.evt.deltaY > 0 ? 1 / 1.12 : 1.12);
    },
    [zoomAround],
  );

  const toWorld = useCallback(
    (pointerX: number, pointerY: number) => ({
      x: Math.min(
        BODY_VIEWBOX_WIDTH,
        Math.max(0, (pointerX - transform.x) / transform.scale),
      ),
      y: Math.min(
        BODY_VIEWBOX_HEIGHT,
        Math.max(0, (pointerY - transform.y) / transform.scale),
      ),
    }),
    [transform],
  );

  const handleStageClick = useCallback(
    (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (dragDistance.current > 6) return;
      if (!addingMode || paintMode) return;
      const stage = stageRef.current;
      if (!stage) return;
      // klik tylko w tło (nie w marker)
      if (e.target !== stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const { x, y } = toWorld(pointer.x, pointer.y);
      if (partMode) {
        const partId = hitTestBodyPart(figure, side, x, y);
        if (partId) onPartClick(partId);
        return;
      }
      onMapClick(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
    },
    [
      addingMode,
      paintMode,
      partMode,
      figure,
      side,
      onMapClick,
      onPartClick,
      toWorld,
    ],
  );

  const beginStroke = useCallback(() => {
    if (!paintMode) return;
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return;
    const point = toWorld(pointer.x, pointer.y);
    painting.current = true;
    strokePoints.current = [point.x, point.y];
    setCurrentStroke([point.x, point.y]);
    setBrushPos(point);
  }, [paintMode, toWorld]);

  const extendStroke = useCallback(() => {
    if (!paintMode) return;
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return;
    const point = toWorld(pointer.x, pointer.y);
    setBrushPos(point);
    if (!painting.current) return;
    const points = strokePoints.current;
    if (!points || points.length >= MAX_FRONT_STROKE_POINTS) return;
    const dx = point.x - points[points.length - 2];
    const dy = point.y - points[points.length - 1];
    if (dx * dx + dy * dy < 1.4) return;
    points.push(point.x, point.y);
    setCurrentStroke([...points]);
  }, [paintMode, toWorld]);

  const endStroke = useCallback(() => {
    if (!painting.current) return;
    painting.current = false;
    const points = strokePoints.current;
    strokePoints.current = null;
    setCurrentStroke(null);
    if (points && points.length >= 2) {
      onPaintStroke({ points, radius: brushRadius });
    }
  }, [brushRadius, onPaintStroke]);

  const handlePointerMove = useCallback(() => {
    if (paintMode) {
      extendStroke();
      return;
    }
    if (!partMode) return;
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return;
    const point = toWorld(pointer.x, pointer.y);
    setHoverPart(hitTestBodyPart(figure, side, point.x, point.y));
  }, [paintMode, partMode, figure, side, extendStroke, toWorld]);

  const handleTouchMove = useCallback(
    (e: KonvaEventObject<TouchEvent>) => {
      if (paintMode) {
        if (e.evt.touches.length === 1) extendStroke();
        return;
      }
      const stage = stageRef.current;
      if (!stage) return;
      const touches = e.evt.touches;
      if (touches.length !== 2) return;
      e.evt.preventDefault();

      const [t1, t2] = [touches[0], touches[1]];
      const distance = Math.hypot(
        t2.clientX - t1.clientX,
        t2.clientY - t1.clientY,
      );
      const stageBox = stage.container().getBoundingClientRect();
      const centerX = (t1.clientX + t2.clientX) / 2 - stageBox.left;
      const centerY = (t1.clientY + t2.clientY) / 2 - stageBox.top;

      if (lastTouchDistance.current === null) {
        lastTouchDistance.current = distance;
        return;
      }

      const ratio = distance / lastTouchDistance.current;
      lastTouchDistance.current = distance;
      zoomAround(centerX, centerY, ratio);
    },
    [paintMode, extendStroke, zoomAround],
  );

  const handleTouchEnd = useCallback(() => {
    lastTouchDistance.current = null;
    endStroke();
  }, [endStroke]);

  const visibleFindings = findings.filter((f) => f.side === side);
  const zoomed = transform.scale > size.fitScale * 1.01;
  const pendingPartPolygon = pendingPart
    ? bodyPartPolygon(figure, side, pendingPart)
    : null;
  const hoverPartPolygon =
    partMode && hoverPart && hoverPart !== pendingPart
      ? bodyPartPolygon(figure, side, hoverPart)
      : null;

  return (
    <div
      ref={containerRef}
      className={`relative w-full select-none overflow-hidden rounded-xl border border-zinc-200 bg-white ${
        addingMode ? "cursor-crosshair" : "cursor-grab"
      }`}
      style={
        size.width === 0
          ? { aspectRatio: `${BODY_VIEWBOX_WIDTH} / ${BODY_VIEWBOX_HEIGHT}` }
          : { height: size.height }
      }
    >
      {size.width > 0 ? (
        <>
          {/* sylwetka pod przezroczystym Stage, z ta sama transformacja */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/body/${figure}-${side}.svg`}
            alt={`Sylwetka (${figure === "male" ? "mężczyzna" : "kobieta"}) — ${
              side === "front" ? "przód" : "tył"
            }`}
            draggable={false}
            className="pointer-events-none absolute left-0 top-0 max-w-none"
            style={{
              width: BODY_VIEWBOX_WIDTH,
              height: BODY_VIEWBOX_HEIGHT,
              transformOrigin: "0 0",
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            }}
          />
          <Stage
            ref={stageRef}
            width={size.width}
            height={size.height}
            scaleX={transform.scale}
            scaleY={transform.scale}
            x={transform.x}
            y={transform.y}
            draggable={!paintMode}
            onMouseDown={() => {
              dragDistance.current = 0;
              beginStroke();
            }}
            onTouchStart={(e) => {
              dragDistance.current = 0;
              if (e.evt.touches.length === 1) beginStroke();
            }}
            onMouseMove={handlePointerMove}
            onMouseUp={endStroke}
            onMouseLeave={() => {
              endStroke();
              setBrushPos(null);
              setHoverPart(null);
            }}
            onDragMove={(e) => {
              if (e.target !== stageRef.current) return;
              dragDistance.current += 2;
              const pos = e.target.position();
              const clamped = clampTransform(
                { scale: transform.scale, x: pos.x, y: pos.y },
                size,
              );
              e.target.position({ x: clamped.x, y: clamped.y });
              setTransform(clamped);
            }}
            onWheel={handleWheel}
            onClick={handleStageClick}
            onTap={handleStageClick}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <Layer listening={!paintMode}>
              {visibleFindings.map((finding) => {
                const isSelected = finding.id === selectedId;
                if (finding.geometry.kind === "part") {
                  const polygon = bodyPartPolygon(
                    figure,
                    finding.side,
                    finding.geometry.part,
                  );
                  if (!polygon) return null;
                  return (
                    <Line
                      key={finding.id}
                      points={polygon as number[]}
                      closed
                      fill={finding.color}
                      opacity={isSelected ? 0.5 : 0.32}
                      stroke={isSelected ? "#6d28d9" : finding.color}
                      strokeWidth={(isSelected ? 4 : 2) / transform.scale}
                      dash={isSelected ? undefined : [6 / transform.scale, 4 / transform.scale]}
                      onClick={(e) => {
                        e.cancelBubble = true;
                        if (dragDistance.current > 6) return;
                        onMarkerClick(finding);
                      }}
                      onTap={(e) => {
                        e.cancelBubble = true;
                        onMarkerClick(finding);
                      }}
                    />
                  );
                }
                if (finding.geometry.kind === "area") {
                  const strokes = finding.geometry.strokes;
                  return (
                    <Group
                      key={finding.id}
                      onClick={(e) => {
                        e.cancelBubble = true;
                        if (dragDistance.current > 6) return;
                        onMarkerClick(finding);
                      }}
                      onTap={(e) => {
                        e.cancelBubble = true;
                        onMarkerClick(finding);
                      }}
                    >
                      {isSelected
                        ? strokes.map((stroke, index) => (
                            <Line
                              key={`halo-${index}`}
                              points={stroke.points}
                              stroke="#6d28d9"
                              strokeWidth={stroke.radius * 2 + 8}
                              lineCap="round"
                              lineJoin="round"
                              opacity={0.55}
                              listening={false}
                            />
                          ))
                        : null}
                      {strokes.map((stroke, index) => (
                        <Line
                          key={index}
                          points={stroke.points}
                          stroke={finding.color}
                          strokeWidth={stroke.radius * 2}
                          lineCap="round"
                          lineJoin="round"
                          opacity={0.8}
                          hitStrokeWidth={stroke.radius * 2 + 10}
                        />
                      ))}
                    </Group>
                  );
                }
                const radius = (isSelected ? 14 : 10) / transform.scale;
                return (
                  <Circle
                    key={finding.id}
                    x={finding.geometry.x}
                    y={finding.geometry.y}
                    radius={radius}
                    fill={finding.color}
                    opacity={0.85}
                    stroke={isSelected ? "#6d28d9" : "#ffffff"}
                    strokeWidth={(isSelected ? 4 : 2.5) / transform.scale}
                    shadowColor="rgba(0,0,0,0.35)"
                    shadowBlur={4}
                    hitStrokeWidth={20 / transform.scale}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      if (dragDistance.current > 6) return;
                      onMarkerClick(finding);
                    }}
                    onTap={(e) => {
                      e.cancelBubble = true;
                      onMarkerClick(finding);
                    }}
                  />
                );
              })}
            </Layer>
            <Layer listening={false}>
              {pendingStrokes.map((stroke, index) => (
                <Line
                  key={index}
                  points={stroke.points}
                  stroke={stroke.color}
                  strokeWidth={stroke.radius * 2}
                  lineCap="round"
                  lineJoin="round"
                  opacity={0.6}
                />
              ))}
              {currentStroke ? (
                <Line
                  points={currentStroke}
                  stroke={paintColor}
                  strokeWidth={brushRadius * 2}
                  lineCap="round"
                  lineJoin="round"
                  opacity={0.6}
                />
              ) : null}
              {pendingPoint ? (
                <Circle
                  x={pendingPoint.x}
                  y={pendingPoint.y}
                  radius={12 / transform.scale}
                  fill={pendingPoint.color}
                  opacity={0.7}
                  stroke="#18181b"
                  strokeWidth={2 / transform.scale}
                  dash={[4 / transform.scale, 3 / transform.scale]}
                />
              ) : null}
              {pendingPartPolygon ? (
                <Line
                  points={pendingPartPolygon as number[]}
                  closed
                  fill={paintColor}
                  opacity={0.35}
                  stroke="#18181b"
                  strokeWidth={2 / transform.scale}
                  dash={[5 / transform.scale, 4 / transform.scale]}
                />
              ) : null}
              {hoverPartPolygon ? (
                <Line
                  points={hoverPartPolygon as number[]}
                  closed
                  fill={paintColor}
                  opacity={0.18}
                  stroke={paintColor}
                  strokeWidth={1.5 / transform.scale}
                />
              ) : null}
              {paintMode && brushPos ? (
                <Circle
                  x={brushPos.x}
                  y={brushPos.y}
                  radius={brushRadius}
                  stroke="#18181b"
                  strokeWidth={1.2 / transform.scale}
                  dash={[3 / transform.scale, 2.5 / transform.scale]}
                  fill={paintColor}
                  opacity={0.35}
                />
              ) : null}
            </Layer>
          </Stage>
          <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => zoomAround(size.width / 2, size.height / 2, 1.4)}
              aria-label="Powiększ"
              className="px-2.5 py-1 text-base leading-none text-zinc-700 hover:bg-zinc-50"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => zoomAround(size.width / 2, size.height / 2, 1 / 1.4)}
              aria-label="Pomniejsz"
              className="border-t border-zinc-200 px-2.5 py-1 text-base leading-none text-zinc-700 hover:bg-zinc-50"
            >
              −
            </button>
          </div>
          {zoomed ? (
            <button
              type="button"
              onClick={() => setTransform(fitTransform(size))}
              className="absolute left-3 top-3 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
            >
              Cała sylwetka
            </button>
          ) : null}
          {addingMode ? (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-zinc-900/85 px-4 py-1.5 text-xs font-medium text-white shadow">
              {paintMode
                ? "Przeciągnij po sylwetce, aby pomalować obszar"
                : partMode
                  ? "Kliknij część ciała, którą chcesz zaznaczyć"
                  : "Kliknij na sylwetkę, aby zaznaczyć zmianę"}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
