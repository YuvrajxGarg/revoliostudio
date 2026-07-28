"use client";

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

/** Progress ring for a stat tile — shows how far along a value is toward a target. */
export function ProgressRing({
  progress,
  colorVar,
  children,
}: {
  progress: number;
  colorVar: string;
  children?: React.ReactNode;
}) {
  const r = 16;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(progress, 1));

  return (
    <div className="relative h-10 w-10 shrink-0">
      <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="3.5" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={colorVar}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
