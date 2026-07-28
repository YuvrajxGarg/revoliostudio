"use client";

import { Flame, Trophy } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";

/** Hero streak card — an animated flame, a fire-gradient streak number, and a progress bar racing toward the personal best. */
export function StreakCard({ current, longest }: { current: number; longest: number }) {
  const animatedCurrent = useCountUp(current);
  const isRecord = current > 0 && current === longest;
  const ratio = longest > 0 ? Math.min(current / longest, 1) : current > 0 ? 1 : 0;

  const message =
    current === 0
      ? longest > 0
        ? `Best streak: ${longest} day${longest === 1 ? "" : "s"} — generate today to start a new one`
        : "Generate today to start your first streak"
      : isRecord
        ? "New personal best!"
        : `${longest - current} day${longest - current === 1 ? "" : "s"} to beat your best of ${longest}`;

  return (
    <div className="animate-stat-tile-in relative col-span-2 overflow-hidden rounded-xl border border-border-subtle/60 bg-gradient-to-br from-accent/10 via-surface-2/50 to-surface-2/50 p-4">
      <div className="flex items-center gap-4">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
          <div className="animate-flame-glow absolute inset-0 rounded-full bg-accent/30 blur-xl" />
          <Flame className="animate-flame-flicker relative h-9 w-9 text-accent drop-shadow-[0_0_8px_rgba(232,80,2,0.5)]" fill="currentColor" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="bg-gradient-to-r from-yellow-400 via-accent to-red-600 bg-clip-text text-4xl font-bold leading-none text-transparent">
              {animatedCurrent}
            </span>
            <span className="text-sm font-medium text-muted">day{current === 1 ? "" : "s"} streak</span>
            {isRecord && <span className="text-base">🏆</span>}
          </div>
          <p className="mt-1 truncate text-xs text-muted">{message}</p>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-yellow-400 via-accent to-red-600 transition-all duration-700 ease-out"
              style={{ width: `${ratio * 100}%` }}
            />
          </div>
        </div>

        <div className="hidden shrink-0 flex-col items-center gap-0.5 border-l border-border-subtle/60 pl-4 sm:flex">
          <Trophy className="h-4 w-4 text-yellow-500" />
          <span className="text-xl font-semibold text-foreground">{longest}</span>
          <span className="text-[10px] text-muted">best</span>
        </div>
      </div>
    </div>
  );
}
