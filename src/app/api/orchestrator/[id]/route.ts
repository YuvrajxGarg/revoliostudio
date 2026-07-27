import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { advanceRun } from "@/lib/orchestratorRun";
import type { OrchestratorMessage, OrchestratorRun } from "@/lib/orchestrator-types";

export const runtime = "nodejs";

/**
 * Poll a single Autopilot run. While it's "running", this is also what
 * drives it forward — same pattern as GET /api/jobs/[id] doubling as both a
 * status read AND the thing that updates muapi status into the DB, just one
 * level up (a run's current step, then the run itself once every step
 * settles).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: row, error } = await supabase
    .from("orchestrator_runs")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (row.status !== "running") return NextResponse.json(row);

  const advanced = await advanceRun(supabase, user.id, row as OrchestratorRun);
  return NextResponse.json(advanced ?? row);
}

/**
 * Discard a proposed (not-yet-run) batch of steps. For a brand-new thread
 * where nothing has ever run, this deletes the whole thread — same as
 * before. For a follow-up on a thread that already has completed/running
 * history, deleting the whole row would throw away real generations'
 * context, so instead this trims off just the trailing pending steps (and
 * the message that introduced them) and leaves the rest of the thread
 * exactly as it was, dropping status back to whatever it was after the last
 * completed batch.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: row, error: fetchError } = await supabase
    .from("orchestrator_runs")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (fetchError || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const run = row as OrchestratorRun;

  const hasHistory = run.plan.some((s) => s.status !== "pending");
  if (!hasHistory) {
    const { error } = await supabase.from("orchestrator_runs").delete().eq("id", id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, deleted: true });
  }

  // Trim only the trailing run of still-pending steps (this batch's proposal
  // — anything before it already ran and stays untouched).
  let cut = run.plan.length;
  while (cut > 0 && run.plan[cut - 1].status === "pending") cut--;
  const plan = run.plan.slice(0, cut);
  const droppedIndices = new Set(run.plan.slice(cut).map((s) => s.index));
  const messages: OrchestratorMessage[] = run.messages.filter(
    (m) => !(m.stepIndices && m.stepIndices.every((i) => droppedIndices.has(i)))
  );
  const status = plan.some((s) => s.status === "running")
    ? "running"
    : plan.some((s) => s.status === "failed")
      ? "failed"
      : plan.length === 0
        ? "cancelled"
        : "completed";
  const totalCostUsd = Math.round(plan.reduce((sum, s) => sum + (s.costUsd ?? 0), 0) * 1000) / 1000;

  const { data: updated, error } = await supabase
    .from("orchestrator_runs")
    .update({ plan, messages, status, total_cost_usd: totalCostUsd })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(updated ?? { ok: true, deleted: false });
}
