"use client";

import { useMemo, useState } from "react";
import { CircleDollarSign, Sparkles, Layers } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Dropdown } from "@/components/ui/Dropdown";
import { formatRelativeTime } from "@/lib/utils";
import { formatCostUSD } from "@/lib/pricing";

export interface UsageHistoryRow {
  id: string;
  model_label: string;
  category: string;
  status: string;
  cost_usd: number | null;
  created_at: string;
}

const SEGMENT_COLORS = [
  "#e85002", "#f16001", "#c10801", "#d9c3ab", "#a7a7a7", "#646464", "#ff8a3d", "#f9f9f9",
];

const PERIODS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

export function UsageOverview({ rows }: { rows: UsageHistoryRow[] }) {
  const [period, setPeriod] = useState("7");

  const filtered = useMemo(() => {
    if (period === "all") return rows;
    const days = Number(period);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return rows.filter((r) => new Date(r.created_at).getTime() >= cutoff);
  }, [rows, period]);

  const totalCostUsd = filtered.reduce((s, r) => s + Number(r.cost_usd || 0), 0);
  const featuresUsed = new Set(filtered.map((r) => r.model_label)).size;
  const totalGenerations = filtered.length;

  const bySpend = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered) {
      map.set(r.model_label, (map.get(r.model_label) ?? 0) + Number(r.cost_usd || 0));
    }
    return Array.from(map.entries())
      .map(([model_label, total_cost_usd]) => ({ model_label, total_cost_usd }))
      .sort((a, b) => b.total_cost_usd - a.total_cost_usd);
  }, [filtered]);

  const top = bySpend.slice(0, 7);
  const otherCost = bySpend.slice(7).reduce((s, r) => s + r.total_cost_usd, 0);
  const segments = otherCost > 0 ? [...top, { model_label: "Other", total_cost_usd: otherCost }] : top;
  const segmentTotal = segments.reduce((s, r) => s + r.total_cost_usd, 0) || 1;

  const recent = filtered.slice(0, 30);

  const stats = [
    { label: "Total cost", value: formatCostUSD(totalCostUsd), icon: CircleDollarSign },
    { label: "Features used", value: String(featuresUsed), icon: Sparkles },
    { label: "Total generations", value: totalGenerations.toLocaleString(), icon: Layers },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Spend overview</h2>
        <Dropdown value={period} options={PERIODS} onChange={setPeriod} panelTitle="Time range" align="right" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="p-4 flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
              <s.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-semibold truncate">{s.value}</div>
              <div className="text-xs text-muted">{s.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {segments.length > 0 && (
        <Card className="p-4">
          <div className="text-xs text-muted mb-2">Spend by feature</div>
          <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-surface-2">
            {segments.map((s, i) => (
              <div
                key={s.model_label}
                style={{
                  width: `${(s.total_cost_usd / segmentTotal) * 100}%`,
                  backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                }}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {segments.map((s, i) => (
              <div key={s.model_label} className="flex items-center gap-1.5 text-xs">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                />
                <span className="text-foreground/90">{s.model_label}</span>
                <span className="text-muted">{Math.round((s.total_cost_usd / segmentTotal) * 100)}%</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold">Usage history</h2>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
            {totalGenerations.toLocaleString()}
          </span>
        </div>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Cost</th>
                <th className="px-4 py-3 font-medium">Feature</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-b border-border-subtle/60 last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {r.cost_usd != null ? formatCostUSD(r.cost_usd) : "—"}
                  </td>
                  <td className="px-4 py-3">{r.model_label}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        r.status === "failed"
                          ? "text-danger-text"
                          : r.status === "completed"
                          ? "text-accent"
                          : "text-muted"
                      }
                    >
                      {r.status === "completed" ? "Spent" : r.status === "failed" ? "Failed" : "Pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{formatRelativeTime(r.created_at)}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted">
                    No usage in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
