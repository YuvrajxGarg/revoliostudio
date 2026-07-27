import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { planBrief, PlanningError, type TaggedReference } from "@/lib/orchestrator";
import { chatReply, AssistantError } from "@/lib/assistant";
import type { OrchestratorMessage, OrchestratorRun } from "@/lib/orchestrator-types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Send a follow-up in an existing Pilot thread — the conversational
 * counterpart to POST /api/orchestrator/plan (which only starts brand-new
 * threads). In Assistant mode this is just the next chat turn, answered
 * immediately. In Autopilot mode, planBrief() figures out what the message
 * is actually asking for — brand-new steps to append, an in-place edit to a
 * step that's already planned but hasn't run yet (e.g. "change step 2's
 * model"), a removal of one or more not-yet-run steps, or any mix of the
 * three — and this route applies all of it onto the thread's running
 * plan/messages, then puts the thread back into "awaiting_approval" so
 * whatever's still pending gets the same show-cost-then-approve treatment
 * as the very first plan did.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { text?: string; references?: TaggedReference[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) return NextResponse.json({ error: "Type a message for Pilot" }, { status: 400 });
  const references: TaggedReference[] = Array.isArray(body.references)
    ? body.references.filter((r) => r?.url).map((r) => ({ url: r.url, tag: r.tag?.trim() || undefined }))
    : [];
  const referenceUrls = references.map((r) => r.url);

  const { data: row, error: fetchError } = await supabase
    .from("orchestrator_runs")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (fetchError || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const run = row as OrchestratorRun;
  if (run.status === "running") {
    return NextResponse.json({ error: "Wait for the current step to finish before sending another message." }, { status: 409 });
  }

  const now = new Date().toISOString();

  if (run.mode === "assistant") {
    try {
      const reply = await chatReply({ message: text, llmModel: run.planner_model, history: run.messages, referenceUrls });
      const newMessages: OrchestratorMessage[] = [
        { role: "user", text, createdAt: now, referenceUrls: referenceUrls.length ? referenceUrls : undefined },
        { role: "assistant", text: reply, createdAt: now },
      ];
      const { data: updated, error: updateError } = await supabase
        .from("orchestrator_runs")
        .update({ messages: [...run.messages, ...newMessages], status: "completed" })
        .eq("id", id)
        .select()
        .single();
      if (updateError || !updated) {
        return NextResponse.json({ error: updateError?.message || "Failed to save the reply" }, { status: 500 });
      }
      return NextResponse.json(updated);
    } catch (err) {
      const message = err instanceof AssistantError ? err.message : "Pilot couldn't reply";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  try {
    const { steps, updatedSteps, removedIndices, totalCostUsd: newTotalCostUsd } = await planBrief({
      instruction: text,
      plannerModel: run.planner_model,
      existingSteps: run.plan,
      references,
    });

    // Apply edits in place first (same absolute index, new content), then
    // drop removed steps, then append whatever's genuinely new — in that
    // order, so a follow-up like "change step 2's model" never shows up as
    // an extra step alongside the untouched original.
    let plan = run.plan.map((s) => {
      const updated = updatedSteps.find((u) => u.index === s.index);
      return updated ?? s;
    });
    if (removedIndices.length > 0) {
      plan = plan.filter((s) => !removedIndices.includes(s.index));
    }
    plan = [...plan, ...steps];

    // Describe what actually happened rather than always saying "planned N
    // more steps" — a pure edit/removal follow-up shouldn't be reported as
    // if new steps were added when none were.
    const summaryParts: string[] = [];
    if (updatedSteps.length > 0) summaryParts.push(`updated ${updatedSteps.length} step${updatedSteps.length === 1 ? "" : "s"}`);
    if (removedIndices.length > 0) summaryParts.push(`removed ${removedIndices.length} step${removedIndices.length === 1 ? "" : "s"}`);
    if (steps.length > 0) summaryParts.push(`planned ${steps.length} more step${steps.length === 1 ? "" : "s"}`);
    const summary = summaryParts.join(", ") || "updated the plan";
    const summaryText = `${summary.charAt(0).toUpperCase()}${summary.slice(1)} — review and run when ready.`;

    const newMessages: OrchestratorMessage[] = [
      { role: "user", text, createdAt: now, referenceUrls: referenceUrls.length ? referenceUrls : undefined },
      {
        role: "assistant",
        text: summaryText,
        createdAt: now,
        stepIndices: [...updatedSteps.map((s) => s.index), ...steps.map((s) => s.index)],
      },
    ];

    // Running total = every already-actualized cost (completed steps have
    // their real costUsd from the generation) plus every still-pending
    // step's estimate — recomputed from the whole (post-edit/removal) plan
    // array rather than adding newTotalCostUsd on top of the stored total,
    // so it stays correct however this follow-up changed the plan.
    const totalCostUsd = Math.round(plan.reduce((sum, s) => sum + (s.costUsd ?? 0), 0) * 1000) / 1000;
    void newTotalCostUsd; // folded into the recompute above, kept for clarity of intent

    // Normally there's something new/edited pending to review, so this goes
    // back to "awaiting_approval" same as before. But a follow-up that only
    // removed steps (or only edited ones that then got dropped by a later
    // removal in the same batch) can leave nothing pending at all — in that
    // case fall back to the same status DELETE's partial-discard uses, so
    // the composer doesn't show a stale "run it" prompt for an empty batch.
    const hasPending = plan.some((s) => s.status === "pending");
    const status = hasPending
      ? "awaiting_approval"
      : plan.some((s) => s.status === "running")
        ? "running"
        : plan.some((s) => s.status === "failed")
          ? "failed"
          : "completed";

    const { data: updated, error: updateError } = await supabase
      .from("orchestrator_runs")
      .update({
        plan,
        messages: [...run.messages, ...newMessages],
        status,
        total_cost_usd: totalCostUsd,
      })
      .eq("id", id)
      .select()
      .single();
    if (updateError || !updated) {
      return NextResponse.json({ error: updateError?.message || "Failed to save the follow-up" }, { status: 500 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof PlanningError ? err.message : "Failed to plan this follow-up";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
