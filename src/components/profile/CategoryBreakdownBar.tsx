"use client";

import { useState } from "react";
import { Image as ImageIcon, Video, Box } from "lucide-react";
import { cn } from "@/lib/utils";

interface Segment {
  key: string;
  label: string;
  count: number;
  colorVar: string;
  icon: typeof ImageIcon;
}

/** Each segment is at least this wide, so a 1-of-300 category still reads as a deliberate pill rather than a broken sliver. */
const MIN_SEGMENT_PERCENT = 4;

/**
 * Stacked "generation mix" bar. Segments are individually rounded pills with
 * a real gap between them rather than slices of one clipped track — a
 * near-zero category (1 of 300) then reads as an intentional small pill
 * instead of a 1px shard against a rounded edge. Widths are floored at
 * MIN_SEGMENT_PERCENT and the remainder is redistributed across the
 * unfloored segments, so the row always sums to exactly 100%.
 */
export function CategoryBreakdownBar({
  imageCount,
  videoCount,
  model3dCount,
}: {
  imageCount: number;
  videoCount: number;
  model3dCount: number;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = imageCount + videoCount + model3dCount;

  const segments: Segment[] = [
    { key: "image", label: "Image", count: imageCount, colorVar: "var(--series-image)", icon: ImageIcon },
    { key: "video", label: "Video", count: videoCount, colorVar: "var(--series-video)", icon: Video },
    { key: "3d", label: "3D", count: model3dCount, colorVar: "var(--series-3d)", icon: Box },
  ];

  if (total === 0) return null;

  const visible = segments.filter((s) => s.count > 0);

  // Floor the tiny segments, then shrink the rest proportionally to pay for it.
  const rawPercents = visible.map((s) => (s.count / total) * 100);
  const flooredIdx = rawPercents.map((p) => p < MIN_SEGMENT_PERCENT);
  const floorDebt = rawPercents.reduce(
    (debt, p, i) => (flooredIdx[i] ? debt + (MIN_SEGMENT_PERCENT - p) : debt),
    0
  );
  const shrinkPool = rawPercents.reduce((sum, p, i) => (flooredIdx[i] ? sum : sum + p), 0);
  const widths = rawPercents.map((p, i) =>
    flooredIdx[i] ? MIN_SEGMENT_PERCENT : shrinkPool > 0 ? p - floorDebt * (p / shrinkPool) : p
  );

  return (
    <div className="relative w-full">
      <p className="mb-2.5 text-sm text-muted">Generation mix</p>

      <div className="flex h-5 w-full gap-1">
        {visible.map((s, i) => (
          <div
            key={s.key}
            className={cn(
              "h-full rounded-full transition-all duration-200",
              hovered && hovered !== s.key ? "opacity-40" : "opacity-100",
              hovered === s.key && "scale-y-125"
            )}
            style={{ width: `${widths[i]}%`, backgroundColor: s.colorVar }}
            onMouseEnter={() => setHovered(s.key)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {segments.map((s) => {
          const Icon = s.icon;
          const pct = total ? (s.count / total) * 100 : 0;
          return (
            <div
              key={s.key}
              className={cn(
                "flex items-center gap-2 rounded-lg border border-border-subtle/60 bg-surface-2/40 px-2.5 py-1.5 transition-all duration-200",
                hovered === s.key && "-translate-y-0.5 border-border-subtle"
              )}
              onMouseEnter={() => setHovered(s.key)}
              onMouseLeave={() => setHovered(null)}
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-md"
                style={{ backgroundColor: `color-mix(in srgb, ${s.colorVar} 18%, transparent)`, color: s.colorVar }}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs text-muted">{s.label}</span>
              <span className="text-sm font-semibold text-foreground">{s.count}</span>
              <span className="text-[11px] text-muted">
                {pct > 0 && pct < 1 ? "<1" : Math.round(pct)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
