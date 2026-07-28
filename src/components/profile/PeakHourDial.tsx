"use client";

import { useMemo } from "react";
import { Moon, Sun, Sunrise, Sunset } from "lucide-react";

const C = 60; // center
const R = 46; // ring radius
const CIRCUMFERENCE = 2 * Math.PI * R;

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

/**
 * Minimal clock: a hairline ring, one accent arc sweeping from 12 round to
 * the user's busiest hour, and a hand resting on it. Both the arc and the
 * hand animate in from 12 on mount, which is the only motion in the card.
 *
 * Earlier passes tried a 24-hour dial with the full hourly distribution on
 * the rim. It was arithmetically correct but consistently misread — anything
 * circular with a hand reads as a clock, and on a clock 2 PM belongs at the
 * "2". The form now matches that instinct, and the AM/PM a 12-hour face
 * can't express is carried by the label beside it.
 */
export function PeakHourDial({ hourlyCounts }: { hourlyCounts: Record<string, number> | null | undefined }) {
  const peakLocalHour = useMemo(() => {
    // Buckets arrive as whole UTC hours. In a half-hour zone (IST, ACST,
    // NPT…) one UTC hour straddles two local hours — 15:00 UTC is 20:30
    // IST, i.e. half in the local 8 PM bucket and half in the 9 PM one.
    // Rounding the offset to a whole hour would shove the entire count into
    // one of them and can name the wrong peak outright, so split each
    // bucket across the two local hours it actually overlaps.
    const offset = -new Date().getTimezoneOffset() / 60;
    const whole = Math.floor(offset);
    const frac = offset - whole;

    const local = new Array(24).fill(0) as number[];
    // hourly_counts arrives only from the 0040 migration onward — render
    // nothing rather than throwing if the deployed RPC predates it.
    for (const [utcHour, count] of Object.entries(hourlyCounts ?? {})) {
      const h = Number(utcHour);
      const a = (((h + whole) % 24) + 24) % 24;
      local[a] += count * (1 - frac);
      if (frac > 0) local[(a + 1) % 24] += count * frac;
    }

    const maxCount = Math.max(...local, 0);
    return maxCount > 0 ? local.indexOf(maxCount) : null;
  }, [hourlyCounts]);

  if (peakLocalHour === null) return null;

  const band = bandFor(peakLocalHour);
  const BandIcon = band.icon;
  const turn = (peakLocalHour % 12) / 12; // 0-1 around the face from 12 o'clock
  const arcFinal = CIRCUMFERENCE * (1 - turn);

  return (
    <div className="animate-stat-tile-in group relative col-span-2 flex items-center gap-5 overflow-hidden rounded-xl border border-border-subtle/60 bg-surface-2/60 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative h-28 w-28 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full">
          {/* hairline ring */}
          <circle cx={C} cy={C} r={R} fill="none" stroke="var(--border-subtle)" strokeWidth="1.5" />

          {/* Arc from 12 round to the peak hour. Static on purpose — a
              keyframed draw-in overrides the inline dashoffset while it
              runs, so a frozen timeline would erase the arc entirely. The
              hand carries the motion; the arc just has to be right. */}
          <circle
            cx={C}
            cy={C}
            r={R}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="4"
            strokeLinecap="round"
            transform={`rotate(-90 ${C} ${C})`}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={arcFinal}
          />

          {/* hand — inner group holds the true angle, outer only animates
              toward it, so the resting position is correct either way */}
          <g
            className="animate-clock-hand"
            style={
              {
                transformOrigin: `${C}px ${C}px`,
                "--sweep-from": `${-turn * 360}deg`,
              } as React.CSSProperties
            }
          >
            <g style={{ transform: `rotate(${turn * 360}deg)`, transformOrigin: `${C}px ${C}px` }}>
              <line x1={C} y1={C} x2={C} y2={C - 28} stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
            </g>
          </g>

          <circle cx={C} cy={C} r="3.5" fill="var(--accent)" />
        </svg>
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
        <p className="mt-2 text-2xl font-bold leading-none text-foreground">{formatHour(peakLocalHour)}</p>
        <p className="mt-1.5 text-sm font-medium text-foreground">{band.label}</p>
        <p className="mt-0.5 text-xs text-muted">peak hour, your time</p>
      </div>
    </div>
  );
}
