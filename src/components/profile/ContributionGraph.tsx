"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, startOfWeek, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import type { DailyCategoryCounts } from "@/lib/types";

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const GAP = 3;
const LABEL_COL = 28;

const RANGE_OPTIONS = [
  { key: "3m", label: "3M", weeks: 13 },
  { key: "6m", label: "6M", weeks: 26 },
  { key: "1y", label: "1Y", weeks: 53 },
] as const;

const CATEGORY_OPTIONS = [
  { key: "total", label: "All", colorVar: "var(--accent)" },
  { key: "image", label: "Image", colorVar: "var(--series-image)" },
  { key: "video", label: "Video", colorVar: "var(--series-video)" },
  { key: "3d", label: "3D", colorVar: "var(--series-3d)" },
] as const;

type CategoryKey = (typeof CATEGORY_OPTIONS)[number]["key"];

function levelFor(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (max <= 1) return 4;
  const ratio = count / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

const LEVEL_OPACITY = [0, 0.28, 0.52, 0.76, 1];

/**
 * GitHub-style activity calendar, filterable by range and category.
 *
 * Cell size is *measured* from the container rather than set in CSS: the
 * grid must fill its card's full width (no horizontal scrollbar) while the
 * cells stay perfectly square and the day-label column stays row-aligned
 * with them. A pure-CSS `flex-1` + `aspect-square` gets the squares but
 * leaves the labels misaligned, so one ResizeObserver drives an explicit
 * px size shared by both.
 */
export function ContributionGraph({ dailyCounts }: { dailyCounts: Record<string, DailyCategoryCounts> }) {
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]>(RANGE_OPTIONS[2]);
  const [category, setCategory] = useState<CategoryKey>("total");
  const [hovered, setHovered] = useState<{ x: number; y: number; date: Date; count: number } | null>(null);
  const [cell, setCell] = useState(13);
  const wrapRef = useRef<HTMLDivElement>(null);

  const activeColor = CATEGORY_OPTIONS.find((c) => c.key === category)!.colorVar;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const usable = el.clientWidth - LABEL_COL - GAP * (range.weeks - 1);
      setCell(Math.max(6, Math.floor(usable / range.weeks)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [range.weeks]);

  const { weeks, monthLabels, max, total } = useMemo(() => {
    const today = new Date();
    const gridStart = startOfWeek(subDays(today, range.weeks * 7 - 1), { weekStartsOn: 0 });

    const cols: { date: Date; key: string; count: number }[][] = [];
    let cursor = gridStart;
    for (let w = 0; w < range.weeks; w++) {
      const col: { date: Date; key: string; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const key = format(cursor, "yyyy-MM-dd");
        const day = dailyCounts[key];
        col.push({ date: cursor, key, count: day?.[category] ?? 0 });
        cursor = addDays(cursor, 1);
      }
      cols.push(col);
    }

    const labels: { index: number; label: string }[] = [];
    let lastMonth = -1;
    cols.forEach((col, i) => {
      const month = col[0].date.getMonth();
      if (month !== lastMonth) {
        labels.push({ index: i, label: format(col[0].date, "MMM") });
        lastMonth = month;
      }
    });

    const allCounts = cols.flat().map((d) => d.count);
    const maxCount = allCounts.length ? Math.max(...allCounts) : 0;
    const totalCount = allCounts.reduce((a, b) => a + b, 0);

    return { weeks: cols, monthLabels: labels, max: maxCount, total: totalCount };
  }, [dailyCounts, range, category]);

  const rangeLabel = range.key === "1y" ? "last year" : range.key === "6m" ? "last 6 months" : "last 3 months";
  const step = cell + GAP;

  return (
    <div className="relative w-full" ref={wrapRef}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          <span className="font-semibold text-foreground">{total}</span> generation{total === 1 ? "" : "s"} in the{" "}
          {rangeLabel}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <FilterPills
            options={CATEGORY_OPTIONS.map((c) => ({ key: c.key, label: c.label }))}
            value={category}
            onChange={(k) => setCategory(k as CategoryKey)}
          />
          <FilterPills
            options={RANGE_OPTIONS.map((r) => ({ key: r.key, label: r.label }))}
            value={range.key}
            onChange={(k) => setRange(RANGE_OPTIONS.find((r) => r.key === k)!)}
          />
        </div>
      </div>

      <div className="flex w-full" style={{ gap: GAP }}>
        <div
          className="flex shrink-0 flex-col text-[10px] text-muted"
          style={{ width: LABEL_COL - GAP, gap: GAP, paddingTop: 18 }}
        >
          {DAY_LABELS.map((label, i) => (
            <span key={i} style={{ height: cell, lineHeight: `${cell}px` }}>
              {label}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative mb-1 h-[14px] text-[10px] text-muted">
            {monthLabels.map(({ index, label }) => (
              <span key={index} className="absolute" style={{ left: index * step }}>
                {label}
              </span>
            ))}
          </div>
          <div className="flex" style={{ gap: GAP }} key={range.key}>
            {weeks.map((col, wi) => (
              <div
                key={wi}
                className="animate-contribution-cell-in flex flex-col"
                style={{ gap: GAP, animationDelay: `${wi * 6}ms` }}
              >
                {col.map((day) => (
                  <div
                    key={day.key}
                    className="relative z-0 rounded-[2px] transition-transform duration-150 hover:z-10 hover:scale-[1.35]"
                    style={{
                      width: cell,
                      height: cell,
                      backgroundColor: day.count > 0 ? activeColor : "var(--surface-2)",
                      opacity: day.count > 0 ? LEVEL_OPACITY[levelFor(day.count, max)] : 1,
                    }}
                    onMouseMove={(e) => setHovered({ x: e.clientX, y: e.clientY, date: day.date, count: day.count })}
                    onMouseLeave={() => setHovered(null)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-end gap-1 text-[10px] text-muted">
        <span>Less</span>
        {LEVEL_OPACITY.map((op, lvl) => (
          <div
            key={lvl}
            className="h-[11px] w-[11px] rounded-[2px]"
            style={{ backgroundColor: lvl === 0 ? "var(--surface-2)" : activeColor, opacity: lvl === 0 ? 1 : op }}
          />
        ))}
        <span>More</span>
      </div>

      {hovered && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border-subtle bg-surface-2 px-2 py-1 text-xs shadow-lg"
          style={{ left: hovered.x, top: hovered.y - 10 }}
        >
          <span className="font-semibold text-foreground">{hovered.count}</span>{" "}
          <span className="text-muted">
            generation{hovered.count === 1 ? "" : "s"} on {format(hovered.date, "MMM d, yyyy")}
          </span>
        </div>
      )}
    </div>
  );
}

function FilterPills({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-border-subtle bg-surface-2/60 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
            value === opt.key ? "bg-accent text-white" : "text-muted hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
