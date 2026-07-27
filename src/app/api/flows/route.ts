import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { OrchestratorStep } from "@/lib/orchestrator-types";

export const runtime = "nodejs";

/** List the current user's flows, plus (with ?scope=public) the Community feed. */
export async function GET(request: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = await createClient();

  const scope = new URL(request.url).searchParams.get("scope");
  if (scope === "public") {
    const { data } = await supabase
      .from("flows")
      .select("*, author:profiles(display_name, email)")
      .eq("is_public", true)
      .order("published_at", { ascending: false })
      .limit(60);
    return NextResponse.json(data ?? []);
  }

  const { data } = await supabase
    .from("flows")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return NextResponse.json(data ?? []);
}

/** Reset a plan snapshot's runtime fields so a saved flow starts clean. */
function sanitizeSteps(steps: OrchestratorStep[]): OrchestratorStep[] {
  return steps.map((s, i) => ({
    index: i,
    label: s.label,
    category: s.category,
    modelId: s.modelId,
    prompt: s.prompt,
    settings: s.settings,
    referenceFromStep: s.referenceFromStep ?? null,
    // Drop user-attached reference URLs — those were specific to the original
    // run; a flow is a reusable recipe, not a one-off.
    referenceUrls: null,
    status: "pending",
    generationId: null,
    outputUrl: null,
    error: null,
    costUsd: s.costUsd ?? null,
  }));
}

/** Create a flow from an Autopilot plan snapshot. */
export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = await createClient();

  let body: {
    name?: string;
    description?: string;
    inputLabel?: string;
    steps?: OrchestratorStep[];
    inputStepIndex?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Give the flow a name" }, { status: 400 });
  if (!Array.isArray(body.steps) || body.steps.length === 0) {
    return NextResponse.json({ error: "A flow needs at least one step" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("flows")
    .insert({
      user_id: user.id,
      name,
      description: body.description?.trim() || null,
      input_label: body.inputLabel?.trim() || "Input",
      steps: sanitizeSteps(body.steps),
      input_step_index: Math.max(0, Math.min(body.inputStepIndex ?? 0, body.steps.length - 1)),
    })
    .select()
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Failed to save flow" }, { status: 500 });
  }
  return NextResponse.json(data);
}
