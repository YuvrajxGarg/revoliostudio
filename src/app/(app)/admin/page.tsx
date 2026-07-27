import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StatsCards } from "@/components/admin/StatsCards";
import { UserTable, type AdminUserRow } from "@/components/admin/UserTable";
import { BillingOverview, type SpendByModelRow, type RecentSpendRow } from "@/components/admin/BillingOverview";
import { CreditsBalanceCard } from "@/components/admin/CreditsBalanceCard";
import { SendNotification } from "@/components/admin/SendNotification";
import { UsageCharts } from "@/components/admin/UsageCharts";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { FeedbackList, type FeedbackRow } from "@/components/admin/FeedbackList";
import { CuratedReferenceLibraryAdmin } from "@/components/admin/CuratedReferenceLibraryAdmin";
import { bucketByWeek, bucketByMonth } from "@/lib/usageStats";
import { formatRelativeTime } from "@/lib/utils";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/studio/image");

  const supabase = await createClient();

  const { data: users } = await supabase
    .from("admin_user_usage")
    .select("*")
    .order("total_generations", { ascending: false });

  const { data: recent } = await supabase
    .from("generations")
    .select("id, model_label, category, status, prompt, created_at, profiles!inner(email)")
    .order("created_at", { ascending: false })
    .limit(30);

  const { data: feedbackRaw } = await supabase
    .from("feedback")
    .select("id, type, body, image_url, page, status, created_at, profiles!inner(email)")
    .order("created_at", { ascending: false })
    .limit(100);
  const feedbackRows: FeedbackRow[] = (feedbackRaw ?? []).map((f) => ({
    id: f.id as string,
    type: f.type as FeedbackRow["type"],
    body: f.body as string,
    image_url: f.image_url as string | null,
    page: f.page as string | null,
    status: f.status as FeedbackRow["status"],
    created_at: f.created_at as string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    email: (f as any).profiles?.email ?? undefined,
  }));

  const { data: spendByModel } = await supabase
    .from("admin_spend_by_model")
    .select("*")
    .order("total_cost_usd", { ascending: false });

  const { data: recentSpend } = await supabase
    .from("generations")
    .select("id, model_label, category, status, cost_usd, seq_number, created_at")
    .order("created_at", { ascending: false })
    .limit(15);

  // Wider window just for the weekly/monthly usage graphs — bucketed
  // client-side (well, here on the server) rather than via a muapi usage
  // API, since we already track cost_usd + created_at ourselves per
  // generation and that's the authoritative source for "what did I spend
  // in Revolio Studio", independent of muapi's own dashboard numbers.
  const { data: usageRows } = await supabase
    .from("generations")
    .select("created_at, cost_usd")
    .order("created_at", { ascending: false })
    .limit(5000);

  const weeklyUsage = bucketByWeek(usageRows ?? [], 8);
  const monthlyUsage = bucketByMonth(usageRows ?? [], 6);

  const rows = (users ?? []) as AdminUserRow[];
  const totalUsers = rows.length;
  const totalGenerations = rows.reduce((s, u) => s + u.total_generations, 0);
  const failedGenerations = rows.reduce((s, u) => s + u.failed_generations, 0);
  const totalCostUsd = rows.reduce((s, u) => s + Number(u.total_cost_usd || 0), 0);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const generationsToday = (recent ?? []).filter((g) => new Date(g.created_at) >= todayStart).length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-6 flex flex-col gap-6">
        <h1 className="text-lg font-semibold">Admin</h1>

        <StatsCards
            totalUsers={totalUsers}
            totalGenerations={totalGenerations}
            generationsToday={generationsToday}
            failedGenerations={failedGenerations}
          />

        <AdminTabs
          usage={
            <div className="flex flex-col gap-6">
              <UsageCharts weekly={weeklyUsage} monthly={monthlyUsage} />

              <div>
                <h2 className="text-sm font-semibold mb-3">Users &amp; usage</h2>
                <UserTable users={rows} />
              </div>

              <div>
                <h2 className="text-sm font-semibold mb-3">Recent activity (all users)</h2>
                <div className="rounded-2xl border border-border-subtle bg-surface divide-y divide-border-subtle">
                  {(recent ?? []).map((g) => (
                    <div key={g.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <span className="text-muted">
                          {/* @ts-expect-error -- joined relation shape */}
                          {g.profiles?.email ?? "unknown"}
                        </span>{" "}
                        generated <span className="font-medium">{g.model_label}</span>
                        <span className="text-muted"> ({g.category})</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={
                            g.status === "failed"
                              ? "text-danger-text text-xs"
                              : g.status === "completed"
                              ? "text-accent text-xs"
                              : "text-muted text-xs"
                          }
                        >
                          {g.status}
                        </span>
                        <span className="text-xs text-muted">{formatRelativeTime(g.created_at)}</span>
                      </div>
                    </div>
                  ))}
                  {(recent ?? []).length === 0 && (
                    <div className="px-4 py-6 text-sm text-muted text-center">No activity yet.</div>
                  )}
                </div>
              </div>
            </div>
          }
          billing={
            <div className="flex flex-col gap-6">
              <CreditsBalanceCard />
              <BillingOverview
                totalCostUsd={totalCostUsd}
                totalGenerations={totalGenerations}
                bySpend={(spendByModel ?? []) as SpendByModelRow[]}
                recent={(recentSpend ?? []) as RecentSpendRow[]}
              />
            </div>
          }
          notifications={<SendNotification />}
          feedback={<FeedbackList initial={feedbackRows} />}
          references={<CuratedReferenceLibraryAdmin />}
        />
      </div>
    </div>
  );
}
