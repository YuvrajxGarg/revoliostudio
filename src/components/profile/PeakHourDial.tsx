"use client";

import { useEffect, useMemo, useState } from "react";
import { Moon, Sun, Sunrise, Sunset } from "lucide-react";

const C = 60; // center
const R = 48; // hour ring radius
const SEG_GAP_DEG = 3;

function formatHour(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}${period}`;
}

function bandFor(hour: number) {
  if (hour >= 5 && hour < 9) return { icon: Sunrise, label: "Early bird" };
  if (hour >= 9 && hour < 17) return { icon: Sun, label: "Daylight maker" };
  if (hour >= 17 && hour < 22) return { icon: Sunset, label: "Golden hour" };
  return { icon: Moon, label: "Night owl" };
}

/** Hour (0-24, fractional ok) → point. 0h at the top, running clockwise. */
function polar(hour: number, radius: number) {
  const rad = (hour / 24) * Math.PI * 2 - Math.PI / 2;
  return [C + Math.cos(rad) * radius, C + Math.sin(rad) * radius] as const;
}

/** SVG arc path between two hour positions at a fixed radius. */
function arc(fromHour: number, toHour: number, radius: number) {
  const [x1, y1] = polar(fromHour, radius);
  const [x2, y2] = polar(toHour, radius);
  return `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
}

/**
 * A 24-hour activity ring: midnight at the top, noon at the bottom, one
 * segment per hour, weighted by how much the user creates then. The
 * busiest hour is the only thing highlighted, and a small tick tracks the
 * viewer's current time. Deliberately spare — the hour and the label live
 * beside it in the card, so the ring only has to carry the shape.
 *
 * Buckets arrive in UTC and are rotated into the viewer's own timezone
 * here, rounded to the nearest hour so half-hour zones like IST land on the
 * closest bucket rather than being dropped.
 */
export function PeakHourDial({ hourlyCounts }: { hourlyCounts: Record<string, number> | null | undefined }) {
  const [nowHour, setNowHour] = useState(() => {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  });

  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNowHour(d.getHours() + d.getMinutes() / 60);
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const { spokes, peakLocalHour, max } = useMemo(() => {
    const offsetHours = Math.round(-new Date().getTimezoneOffset() / 60);
    const local = new Array(24).fill(0) as number[];
    // hourly_counts arrives only from the 0040 migration onward — render
    // nothing rather than throwing if the deployed RPC predates it.
    for (const [utcHour, count] of Object.entries(hourlyCounts ?? {})) {
      const idx = (((Number(utcHour) + offsetHours) % 24) + 24) % 24;
      local[idx] += count;
    }
    const maxCount = Math.max(...local, 0);
    return { spokes: local, peakLocalHour: maxCount > 0 ? local.indexOf(maxCount) : null, max: maxCount };
  }, [hourlyCounts]);

  if (peakLocalHour === null) return null;

  const band = bandFor(peakLocalHour);
  const BandIcon = band.icon;
  const gapHours = (SEG_GAP_DEG / 360) * 24;
  const [nowX, nowY] = polar(nowHour, R);

  return (
    <div className="animate-stat-tile-in group relative col-span-2 flex items-center gap-5 overflow-hidden rounded-xl border border-border-subtle/60 bg-surface-2/60 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative h-28 w-28 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full">
          {spokes.map((count, hour) => {
            const ratio = max > 0 ? count / max : 0;
            const isPeak = hour === peakLocalHour;
            return (
              <path
                key={hour}
                d={arc(hour + gapHours / 2, hour + 1 - gapHours / 2, R)}
                fill="none"
                stroke={isPeak ? "var(--accent)" : "var(--muted)"}
                strokeWidth={isPeak ? 8 : 5}
                strokeLinecap="round"
                opacity={count > 0 ? (isPeak ? 1 : 0.15 + ratio * 0.35) : 0.08}
              />
            );
          })}
          {/* live tick — the viewer's current hour */}
          <circle cx={nowX} cy={nowY} r="2" fill="var(--foreground)" opacity="0.35" />
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold leading-none text-foreground">{formatHour(peakLocalHour)}</span>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110"
            style={{
              backgroundColor: "color-mix(in srgb, var(--stat-violet) 16%, transparent)",
              color: "var(--stat-violet)",
            }}
          >
            <BandIcon className="h-3.5 w-3.5" />
          </span>
          When they create
        </div>
        <p className="mt-2 text-lg font-semibold leading-tight text-foreground">{band.label}</p>
        <p className="mt-1 text-xs text-muted">peak hour, your time</p>
      </div>
    </div>
  );
}
