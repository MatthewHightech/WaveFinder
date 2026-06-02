"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHIP_SIZE_PX } from "@/lib/labeling";

export type BboxPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ChipLabelerProps = {
  imageUrl: string;
  title?: string;
  subtitle?: string;
  /** Called with every bbox drawn on this chip when user clicks Save */
  onSave: (bboxes: BboxPixels[]) => void | Promise<void>;
  onMarkEmpty?: () => void | Promise<void>;
  onSkip?: () => void;
  saving?: boolean;
};

function bboxStyle(b: BboxPixels, color: string, dashed = false) {
  return {
    left: `${(b.x / CHIP_SIZE_PX) * 100}%`,
    top: `${(b.y / CHIP_SIZE_PX) * 100}%`,
    width: `${(b.width / CHIP_SIZE_PX) * 100}%`,
    height: `${(b.height / CHIP_SIZE_PX) * 100}%`,
    borderColor: color,
    backgroundColor: `${color}33`,
    borderStyle: dashed ? ("dashed" as const) : ("solid" as const),
  };
}

const BOX_COLORS = ["#2dd4bf", "#38bdf8", "#a78bfa", "#fbbf24", "#fb7185"];

export function ChipLabeler({
  imageUrl,
  title,
  subtitle,
  onSave,
  onMarkEmpty,
  onSkip,
  saving = false,
}: ChipLabelerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bboxes, setBboxes] = useState<BboxPixels[]>([]);
  const [drag, setDrag] = useState<{
    startX: number;
    startY: number;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  useEffect(() => {
    setBboxes([]);
    setDrag(null);
  }, [imageUrl]);

  const toLocal = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const scale = CHIP_SIZE_PX / rect.width;
    return {
      x: Math.max(0, Math.min(CHIP_SIZE_PX, (clientX - rect.left) * scale)),
      y: Math.max(0, Math.min(CHIP_SIZE_PX, (clientY - rect.top) * scale)),
    };
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    if (saving) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const { x, y } = toLocal(e.clientX, e.clientY);
    setDrag({ startX: x, startY: y, x, y, w: 0, h: 0 });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const { x, y } = toLocal(e.clientX, e.clientY);
    const left = Math.min(drag.startX, x);
    const top = Math.min(drag.startY, y);
    const width = Math.abs(x - drag.startX);
    const height = Math.abs(y - drag.startY);
    setDrag({ ...drag, x: left, y: top, w: width, h: height });
  }

  function onPointerUp() {
    if (!drag || drag.w < 8 || drag.h < 8) {
      setDrag(null);
      return;
    }
    const next: BboxPixels = {
      x: drag.x,
      y: drag.y,
      width: drag.w,
      height: drag.h,
    };
    setBboxes((prev) => [...prev, next]);
    setDrag(null);
  }

  const draft: BboxPixels | null =
    drag && drag.w >= 8 && drag.h >= 8
      ? { x: drag.x, y: drag.y, width: drag.w, height: drag.h }
      : null;

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="flex-1">
        {title && <h2 className="text-lg font-semibold text-teal-400">{title}</h2>}
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        <p className="mt-2 text-xs text-slate-500">
          Drag boxes around each break in this chip. Add as many as you need, then save.
        </p>
        <div
          ref={containerRef}
          className="relative mt-3 aspect-square w-full max-w-[512px] cursor-crosshair select-none touch-none overflow-hidden rounded-lg border border-slate-700 bg-slate-950"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Satellite chip" className="h-full w-full object-cover" draggable={false} />
          {bboxes.map((b, i) => (
            <div
              key={`box-${i}-${b.x}-${b.y}`}
              className="pointer-events-none absolute border-2"
              style={bboxStyle(b, BOX_COLORS[i % BOX_COLORS.length])}
            >
              <span
                className="absolute -left-0.5 -top-5 rounded px-1 text-[10px] font-bold text-slate-900"
                style={{ backgroundColor: BOX_COLORS[i % BOX_COLORS.length] }}
              >
                {i + 1}
              </span>
            </div>
          ))}
          {draft && (
            <div
              className="pointer-events-none absolute border-2"
              style={bboxStyle(draft, "#94a3b8", true)}
            />
          )}
        </div>
        {bboxes.length > 0 && (
          <p className="mt-2 text-xs text-slate-400">
            {bboxes.length} box{bboxes.length === 1 ? "" : "es"} on this chip
          </p>
        )}
      </div>
      <div className="flex w-full flex-col gap-2 lg:w-48">
        <button
          type="button"
          disabled={bboxes.length === 0 || saving}
          onClick={() => onSave(bboxes)}
          className="rounded bg-teal-600 px-4 py-2 text-sm font-medium hover:bg-teal-500 disabled:opacity-40"
        >
          {saving
            ? "Saving…"
            : `Save ${bboxes.length} label${bboxes.length === 1 ? "" : "s"}`}
        </button>
        {onMarkEmpty && (
          <button
            type="button"
            disabled={saving}
            onClick={onMarkEmpty}
            className="rounded bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600 disabled:opacity-40"
          >
            Nothing here (empty)
          </button>
        )}
        {onSkip && (
          <button
            type="button"
            disabled={saving}
            onClick={onSkip}
            className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Skip
          </button>
        )}
        <button
          type="button"
          disabled={saving || bboxes.length === 0}
          onClick={() => setBboxes((prev) => prev.slice(0, -1))}
          className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-40"
        >
          Undo last box
        </button>
        <button
          type="button"
          disabled={saving || bboxes.length === 0}
          onClick={() => setBboxes([])}
          className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-40"
        >
          Clear all boxes
        </button>
      </div>
    </div>
  );
}
