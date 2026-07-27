"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { UsageBucket } from "@/lib/usageStats";

function BarChart({
  buckets,
  valueKey,
  format,
}: {
  buckets: UsageBucket[];
  valueKey: "cost" | "count";
  format: (v: number) => string;
}) {
  const max = Math.max(1, ...buckets.map((b) => b[valueKey]));

  return (
    <div className="flex items-end gap-1.5 sm:gap-2 h-40">
      {buckets.map((b) => {
        const heightPct = b[valueKey] > 0 ? Math.max(3, (b[valueKey] / max) * 100) : 0;
        return (
          <div key={b.label} className="group flex flex-1 flex-col items-center gap-1.5">
            <div className="relative flex h-32 w-full items-end justify-center">
              <div
                title={format(b[valueKey])}
                className="w-full max-w-[28px] rounded-t-md bg-accent/70 transition-colors group-hover:bg-accent"
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <span className="whitespace-nowrap text-[10px] text-muted">{b.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function UsageCharts({ weekly, monthly }: { weekly: UsageBucket[]; monthly: UsageBucket[] }) {
  const [range, setRange] = useState<"week" | "month">("week");
  const buckets = range === "week" ? weekly : monthly;
  const totalCost = buckets.reduce((s, b) => s + b.cost, 0);
  const totalCount = buckets.reduce((s, b) => s + b.count, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Usage over time</h2>
        <div className="flex items-center gap-0.5 rounded-lg border border-border-subtle p-0.5">
          <button
            onClick={() => setRange("week")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs transition-colors",
              range === "week" ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
            )}
          >
            Weekly
          </button>
          <button
            onClick={() => setRange("month")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs transition-colors",
              range === "month" ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
            )}
          >
            Monthly
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-muted">Spend ({range === "week" ? "last 8 weeks" : "last 6 months"})</span>
            <span className="text-sm font-semibold">${totalCost.toFixed(2)}</span>
          </div>
          <BarChart buckets={buckets} valueKey="cost" format={(v) => `$${v.toFixed(2)}`} />
        </Card>
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-muted">
              Generations ({range === "week" ? "last 8 weeks" : "last 6 months"})
            </span>
            <span className="text-sm font-semibold">{totalCount.toLocaleString()}</span>
          </div>
          <BarChart buckets={buckets} valueKey="count" format={(v) => v.toLocaleString()} />
        </Card>
      </div>
    </div>
  );
}
