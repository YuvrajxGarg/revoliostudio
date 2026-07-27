/**
 * Date-bucketing helpers for the admin usage graphs. Aggregates our own
 * `generations` rows (which we fully control) into weekly/monthly buckets
 * of spend + generation count, rather than depending on muapi's `/app/*`
 * usage-log endpoints — those are tagged "Dashboard" in muapi's own
 * OpenAPI spec (not "API") and look like they're built for muapi's own
 * web session auth, not the server-side x-api-key this app authenticates
 * with, so they're not something we can reliably call ourselves.
 */

export interface UsageRow {
  created_at: string;
  cost_usd: number | null;
}

export interface UsageBucket {
  label: string;
  cost: number;
  count: number;
}

/** Last `weeks` 7-day buckets (oldest first), each labeled by its start date. */
export function bucketByWeek(rows: UsageRow[], weeks = 8): UsageBucket[] {
  const now = new Date();
  const buckets: UsageBucket[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const end = new Date(now);
    end.setDate(now.getDate() - i * 7);
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    const inRange = rows.filter((r) => {
      const d = new Date(r.created_at);
      return d >= start && d <= end;
    });

    buckets.push({
      label: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      cost: inRange.reduce((s, r) => s + Number(r.cost_usd || 0), 0),
      count: inRange.length,
    });
  }

  return buckets;
}

/** Last `months` calendar-month buckets (oldest first), labeled "Jan '26" etc. */
export function bucketByMonth(rows: UsageRow[], months = 6): UsageBucket[] {
  const now = new Date();
  const buckets: UsageBucket[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const anchor = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999);

    const inRange = rows.filter((r) => {
      const d = new Date(r.created_at);
      return d >= monthStart && d <= monthEnd;
    });

    buckets.push({
      label: anchor.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      cost: inRange.reduce((s, r) => s + Number(r.cost_usd || 0), 0),
      count: inRange.length,
    });
  }

  return buckets;
}
