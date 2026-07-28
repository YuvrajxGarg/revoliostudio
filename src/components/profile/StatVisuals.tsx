"use client";

import { cn } from "@/lib/utils";

/**
 * Tiny inline bar chart for a stat tile. Bars grow in staggered from the
 * left on mount; the busiest bar is held at full color while the rest fade
 * back by value, so the shape of recent activity reads at a glance without
 * axes or labels. Each bar carries its own hover tooltip and a native
 * `title`, so the values stay reachable without one.
 */
export function MiniBars({
  values,
  labels,
  colorVar,
}: {
  values: number[];
  labels?: string[];
  colorVar: string;
}) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const peak = values.indexOf(max);

  return (
    <div className="flex h-8 w-full items-end gap-[2px]">
      {values.map((v, i) => {
        const ratio = v / max;
        const isPeak = i === peak && v > 0;
        return (
          <div
            key={i}
            title={labels?.[i] ? `${v} on ${labels[i]}` : String(v)}
            className="animate-bar-grow group/bar relative flex-1 rounded-[2px] transition-[filter,opacity] duration-150 hover:brightness-125"
            style={{
              height: `${Math.max(ratio * 100, 8)}%`,
              backgroundColor: colorVar,
              opacity: v === 0 ? 0.15 : isPeak ? 1 : 0.35 + ratio * 0.45,
              animationDelay: `${i * 35}ms`,
            }}
          >
            {labels?.[i] && (
              <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded border border-border-subtle bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted shadow-lg group-hover/bar:block">
                <span className="font-semibold text-foreground">{v}</span> · {labels[i]}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Seven-bar weekday rhythm — which days of the week this user actually
 * shows up on. Reads as a shape (weekday grinder vs weekend hobbyist)
 * rather than a number.
 */
export function WeekdayRhythm({ counts, colorVar }: { counts: number[]; colorVar: string }) {
  const max = Math.max(...counts, 1);
  const peak = counts.indexOf(Math.max(...counts));

  return (
    <div className="flex h-9 w-full items-end gap-1">
      {counts.map((v, i) => {
        const ratio = v / max;
        const isPeak = i === peak && v > 0;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1" title={`${v} on ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][i]}`}>
            <div
              className="animate-bar-grow w-full rounded-[2px]"
              style={{
                height: `${Math.max(ratio * 22, 3)}px`,
                backgroundColor: colorVar,
                opacity: v === 0 ? 0.15 : isPeak ? 1 : 0.3 + ratio * 0.45,
                animationDelay: `${i * 45}ms`,
              }}
            />
            <span className={cn("text-[8px] leading-none", isPeak ? "text-foreground" : "text-muted/60")}>
              {WEEKDAY_INITIALS[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Dot collection — `owned` of `total` pips lit, so model exploration reads
 * as a collection being filled in rather than a bare count.
 */
export function DotCollection({
  owned,
  total,
  colorVar,
}: {
  owned: number;
  total: number;
  colorVar: string;
}) {
  return (
    <div className="flex w-full flex-wrap gap-[3px]">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="animate-stat-tile-in h-1.5 w-1.5 rounded-full"
          style={{
            backgroundColor: i < owned ? colorVar : "var(--surface-2)",
            opacity: i < owned ? 0.5 + (i / total) * 0.5 : 1,
            animationDelay: `${i * 12}ms`,
          }}
        />
      ))}
    </div>
  );
}

/** Share bar — what fraction of the whole one item accounts for. */
export function ShareBar({ ratio, colorVar }: { ratio: number; colorVar: string }) {
  const pct = Math.max(0, Math.min(ratio, 1));
  return (
    <div className="w-full">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-out"
          style={{ width: `${pct * 100}%`, backgroundColor: colorVar }}
        />
      </div>
    </div>
  );
}
