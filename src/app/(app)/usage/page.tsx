import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UsageOverview, type UsageHistoryRow } from "@/components/usage/UsageOverview";
import { UsageCharts } from "@/components/admin/UsageCharts";
import { bucketByWeek, bucketByMonth } from "@/lib/usageStats";

export default async function UsagePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  // Explicitly scoped to this user's own id (not just relying on RLS) —
  // admins have a broader "read all generations" policy, so an unfiltered
  // query here would leak every user's activity into an admin's own usage
  // page. This mirrors the admin billing view's shape but stays personal.
  const { data: rows } = await supabase
    .from("generations")
    .select("id, model_label, category, status, cost_usd, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(3000);

  const weeklyUsage = bucketByWeek(rows ?? [], 8);
  const monthlyUsage = bucketByMonth(rows ?? [], 6);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 md:px-6 py-6 flex flex-col gap-6">
        <div>
          <h1 className="text-lg font-semibold">Usage history</h1>
          <p className="text-xs text-muted mt-0.5">View your spend, history and statistics</p>
        </div>

        <UsageOverview rows={(rows ?? []) as UsageHistoryRow[]} />

        <UsageCharts weekly={weeklyUsage} monthly={monthlyUsage} />
      </div>
    </div>
  );
}
