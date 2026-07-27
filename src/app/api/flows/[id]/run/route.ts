import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { DEFAULT_LLM_MODEL } from "@/lib/llmModels";
import { FLOW_INPUT_TOKEN } from "@/lib/flow-types";
import type { OrchestratorMessage, OrchestratorStep } from "@/lib/orchestrator-types";
import type { Flow } from "@/lib/flow-types";

export const runtime = "nodejs";

/**
 * Run a flow: seed a fresh Autopilot run from the flow's saved steps with the
 * runner's input substituted in, in `awaiting_approval` status so the runner
 * reviews the cost and runs it through the exact same execution pipeline as
 * any Autopilot plan. Returns the new run id; the client opens it in Pilot.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const supabase = await createClient();

  const body = await req.json().catch(() => ({}));
  const input = (body.input ?? "").toString().trim();

  const { data: flow } = (await supabase.from("flows").select("*").eq("id", id).maybeSingle()) as {
    data: Flow | null;
  };
  if (!flow) return NextResponse.json({ error: "Flow not found" }, { status: 404 });

  // Substitute the runner input: replace {{input}} everywhere; if the chosen
  // input step has no token, append the input to its prompt so it still takes
  // effect.
  const inputStep = Math.max(0, Math.min(flow.input_step_index ?? 0, flow.steps.length - 1));
  const steps: OrchestratorStep[] = flow.steps.map((s, i) => {
    let prompt = s.prompt || "";
    if (input) {
      if (prompt.includes(FLOW_INPUT_TOKEN)) {
        prompt = prompt.split(FLOW_INPUT_TOKEN).join(input);
      } else if (i === inputStep) {
        prompt = prompt ? `${prompt}\n\n${input}` : input;
      }
    } else {
      prompt = prompt.split(FLOW_INPUT_TOKEN).join("").trim();
    }
    return {
      ...s,
      index: i,
      prompt,
      status: "pending",
      generationId: null,
      outputUrl: null,
      error: null,
    };
  });

  const totalCostUsd = steps.reduce((sum, s) => sum + (s.costUsd ?? 0), 0);
  const now = new Date().toISOString();
  const briefText = input || flow.name;
  const messages: OrchestratorMessage[] = [
    { role: "user", text: briefText, createdAt: now },
    {
      role: "assistant",
      text: `Running the "${flow.name}" flow — ${steps.length} step${steps.length === 1 ? "" : "s"}. Review and run when ready.`,
      createdAt: now,
      stepIndices: steps.map((s) => s.index),
    },
  ];

  const { data: run, error } = await supabase
    .from("orchestrator_runs")
    .insert({
      user_id: user.id,
      mode: "autopilot",
      brief: briefText,
      title: flow.name,
      plan: steps,
      messages,
      planner_model: DEFAULT_LLM_MODEL,
      status: "awaiting_approval",
      total_cost_usd: totalCostUsd,
    })
    .select("id")
    .single();
  if (error || !run) {
    return NextResponse.json({ error: error?.message || "Failed to start the flow" }, { status: 500 });
  }

  // Best-effort usage counter.
  await supabase
    .from("flows")
    .update({ run_count: (flow.run_count ?? 0) + 1 })
    .eq("id", id);

  return NextResponse.json({ runId: run.id });
}
