import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Cancel a plan before running it, or stop a run between steps. Any step
 * already submitted keeps generating on muapi's side (there's no cancel
 * hook on that API) and still lands in the Library/Project normally — this
 * only stops Autopilot from submitting any *further* steps.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: row } = await supabase
    .from("orchestrator_runs")
    .select("status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (["completed", "failed", "cancelled"].includes(row.status)) {
    return NextResponse.json({ error: "This run has already finished." }, { status: 409 });
  }

  const { data: updated, error } = await supabase
    .from("orchestrator_runs")
    .update({ status: "cancelled" })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(updated);
}
