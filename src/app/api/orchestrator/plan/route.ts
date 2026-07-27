import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { planBrief, PlanningError, type TaggedReference } from "@/lib/orchestrator";
import { chatReply, AssistantError } from "@/lib/assistant";
import { generateChatTitle } from "@/lib/gemini";
import { getLlmModel } from "@/lib/llmModels";
import type { OrchestratorMessage, OrchestratorMode } from "@/lib/orchestrator-types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Start a brand-new Pilot thread — either mode. Follow-ups on an existing thread go through /api/orchestrator/[id]/message instead. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { brief?: string; plannerModel?: string; references?: TaggedReference[]; mode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const brief = body.brief?.trim();
  if (!brief) {
    return NextResponse.json({ error: "Type something for Pilot" }, { status: 400 });
  }
  const mode: OrchestratorMode = body.mode === "assistant" ? "assistant" : "autopilot";
  const plannerModel = getLlmModel(body.plannerModel).id;
  const references: TaggedReference[] = Array.isArray(body.references)
    ? body.references.filter((r) => r?.url).map((r) => ({ url: r.url, tag: r.tag?.trim() || undefined }))
    : [];
  const referenceUrls = references.map((r) => r.url);
  const now = new Date().toISOString();
  // Kicked off in parallel with the main reply/plan call below (not
  // awaited until right before the insert) so naming the thread adds
  // ~zero extra latency — worst case it's as slow as whichever of the two
  // calls takes longer, not both back to back. Best-effort: a naming
  // failure falls back to null (the UI falls back to showing `brief`
  // instead), it should never fail the actual chat/plan request.
  const titlePromise = generateChatTitle({ model: plannerModel, brief }).catch(() => null);

  if (mode === "assistant") {
    try {
      const reply = await chatReply({ message: brief, llmModel: plannerModel, history: [], referenceUrls });
      const title = await titlePromise;
      const messages: OrchestratorMessage[] = [
        { role: "user", text: brief, createdAt: now, referenceUrls: referenceUrls.length ? referenceUrls : undefined },
        { role: "assistant", text: reply, createdAt: now },
      ];
      const { data: row, error } = await supabase
        .from("orchestrator_runs")
        .insert({
          user_id: user.id,
          mode,
          brief,
          title,
          plan: [],
          messages,
          planner_model: plannerModel,
          status: "completed",
          total_cost_usd: null,
        })
        .select()
        .single();
      if (error || !row) {
        return NextResponse.json({ error: error?.message || "Failed to save the chat" }, { status: 500 });
      }
      return NextResponse.json(row);
    } catch (err) {
      const message = err instanceof AssistantError ? err.message : "Pilot couldn't reply";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  try {
    const { steps, totalCostUsd } = await planBrief({
      instruction: brief,
      plannerModel,
      existingSteps: [],
      references,
    });
    const title = await titlePromise;
    const messages: OrchestratorMessage[] = [
      { role: "user", text: brief, createdAt: now, referenceUrls: referenceUrls.length ? referenceUrls : undefined },
      {
        role: "assistant",
        text: `Planned ${steps.length} step${steps.length === 1 ? "" : "s"} — review and run when ready.`,
        createdAt: now,
        stepIndices: steps.map((s) => s.index),
      },
    ];
    const { data: row, error } = await supabase
      .from("orchestrator_runs")
      .insert({
        user_id: user.id,
        mode,
        brief,
        title,
        plan: steps,
        messages,
        planner_model: plannerModel,
        status: "awaiting_approval",
        total_cost_usd: totalCostUsd,
      })
      .select()
      .single();
    if (error || !row) {
      return NextResponse.json({ error: error?.message || "Failed to save the plan" }, { status: 500 });
    }
    return NextResponse.json(row);
  } catch (err) {
    const message = err instanceof PlanningError ? err.message : "Failed to plan this brief";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
