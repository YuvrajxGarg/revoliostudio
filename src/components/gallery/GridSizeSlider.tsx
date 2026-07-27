"use client";

import { Image as ImageIcon } from "lucide-react";

/** Small slider that controls gallery/grid thumbnail size — mirrors the
 * compact resize control in the Reference's history view. */
export function GridSizeSlider({
  value,
  onChange,
  min = 140,
  max = 360,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-2 text-muted">
      <ImageIcon className="h-3.5 w-3.5 shrink-0" />
      <input
        type="range"
        min={min}
        max={max}
        step={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        title="Resize thumbnails"
        className="w-24  slider-thin"
      />
      <ImageIcon className="h-4 w-4 shrink-0" />
    </div>
  );
}
