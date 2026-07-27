import { Card } from "@/components/ui/Card";
import { formatRelativeTime } from "@/lib/utils";
import { formatCostUSD } from "@/lib/pricing";

export interface SpendByModelRow {
  model_id: string;
  model_label: string;
  category: string;
  generations: number;
  total_cost_usd: number;
}

export interface RecentSpendRow {
  id: string;
  model_label: string;
  category: string;
  status: string;
  cost_usd: number | null;
  seq_number: number | null;
  created_at: string;
}

const SEGMENT_COLORS = [
  "#e85002", "#f16001", "#c10801", "#d9c3ab", "#a7a7a7", "#646464", "#ff8a3d", "#f9f9f9",
];

const MUAPI_DASHBOARD_URL = "https://muapi.ai/topup";

export function BillingOverview({
  totalCostUsd,
  totalGenerations,
  bySpend,
  recent,
}: {
  totalCostUsd: number;
  totalGenerations: number;
  bySpend: SpendByModelRow[];
  recent: RecentSpendRow[];
}) {
  const top = bySpend.slice(0, 7);
  const otherCost = bySpend.slice(7).reduce((s, r) => s + Number(r.total_cost_usd), 0);
  const segments = otherCost > 0 ? [...top, { model_label: "Other", total_cost_usd: otherCost }] : top;
  const segmentTotal = segments.reduce((s, r) => s + Number(r.total_cost_usd), 0) || 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Billing &amp; usage (estimated)</h2>
        <a
          href={MUAPI_DASHBOARD_URL}
          target="_blank"
          rel="noreferrer"
          className="text-xs rounded-lg border border-border-subtle bg-surface-2 px-3 py-1.5 hover:bg-border-subtle transition-colors"
        >
          Open muapi billing dashboard →
        </a>
      </div>

      <p className="text-xs text-muted -mt-2">
        Costs below are estimated per generation from our own pricing model, not muapi&apos;s exact
        invoiced total — see the live wallet balance card above (or the dashboard link) for the
        authoritative number.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted">Estimated total cost</div>
          <div className="mt-1 text-2xl font-semibold">${totalCostUsd.toFixed(2)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted">Total generations</div>
          <div className="mt-1 text-2xl font-semibold">{totalGenerations.toLocaleString()}</div>
        </Card>
      </div>

      {segments.length > 0 && (
        <Card className="p-4">
          <div className="text-xs text-muted mb-2">Spend by model</div>
          <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-surface-2">
            {segments.map((s, i) => (
              <div
                key={s.model_label}
                style={{
                  width: `${(Number(s.total_cost_usd) / segmentTotal) * 100}%`,
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
                <span className="text-muted">
                  {Math.round((Number(s.total_cost_usd) / segmentTotal) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">Cost</th>
              <th className="px-4 py-3 font-medium">Model</th>
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
                  No usage yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
