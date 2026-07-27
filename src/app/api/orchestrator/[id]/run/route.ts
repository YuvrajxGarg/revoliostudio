import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startRun } from "@/lib/orchestratorRun";
import type { OrchestratorRun } from "@/lib/orchestrator-types";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Approve a plan and kick off its first step. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  if (row.status !== "awaiting_approval") {
    return NextResponse.json({ error: "This run has already started or finished." }, { status: 409 });
  }

  let run = row as OrchestratorRun;

  // Every run files its generations into its own Project — same as
  // manually creating one, but automatic so a multi-step brief's results
  // end up together in the Library instead of scattered across it.
  if (!run.project_id) {
    const name = run.brief.length > 48 ? `${run.brief.slice(0, 45)}…` : run.brief;
    const { data: project } = await supabase
      .from("projects")
      .insert({ user_id: user.id, name: `Autopilot: ${name}` })
      .select()
      .single();
    if (project) {
      await supabase.from("orchestrator_runs").update({ project_id: project.id }).eq("id", run.id);
      run = { ...run, project_id: project.id };
    }
  }

  const updated = await startRun(supabase, user.id, run);
  return NextResponse.json(updated);
}
