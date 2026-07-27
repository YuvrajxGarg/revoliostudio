/**
 * Autopilot's execution engine — advances an approved run one step at a
 * time. Deliberately NOT one long server-side loop that awaits every step
 * to completion: video/3d generations can take minutes, and a single
 * request handler blocking on all of them would blow past a serverless
 * function's timeout. Instead, each step is submitted and the *next* poll
 * (the client polls GET /api/orchestrator/[id] the same way useGenerations
 * already polls /api/jobs/[id]) is what notices the current step finished
 * and submits the next one — so the whole run advances via a series of
 * short, cheap requests instead of one long-held one.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getModel } from "@/lib/models";
import { handleGenerateRequest } from "@/lib/generate";
import { pollGenerationStatus } from "@/lib/pollGeneration";
import type { OrchestratorRun, OrchestratorStep } from "@/lib/orchestrator-types";

async function submitStep(userId: string, run: OrchestratorRun, step: OrchestratorStep): Promise<OrchestratorStep> {
  const model = getModel(step.modelId);
  if (!model) {
    return { ...step, status: "failed", error: `Model "${step.modelId}" no longer exists in the registry.` };
  }

  const body: Record<string, unknown> = {
    modelId: step.modelId,
    prompt: step.prompt,
    settings: step.settings ?? {},
    projectId: run.project_id,
    toolId: "autopilot",
  };

  // Images the user attached directly to the message that introduced this
  // step (via the @ reference picker) — distinct from, and applied before,
  // the referenceFromStep chain below so a step can use both (e.g. "put the
  // uploaded logo onto the product photo from step 2").
  const userRefs = step.referenceUrls?.filter(Boolean) ?? [];
  if (userRefs.length > 0) {
    body.references = userRefs;
  }

  // Wire this step's dependency (an earlier step's output) into whichever
  // input shape the target model actually expects. Covers the realistic
  // chains a short plan produces — image used as a reference/animate source,
  // or a video fed into an upscale/edit model. Motion-mode models need BOTH
  // a video and a separate character image, which a single upstream output
  // can't supply — chaining into a motion step isn't wired here, so the
  // planner effectively won't produce one (nothing in its catalog notes tell
  // it this is safe), and if it ever did, that step would just fail
  // cleanly with a normal "add both inputs" validation error from
  // handleGenerateRequest rather than silently doing the wrong thing.
  if (step.referenceFromStep != null) {
    // Absolute index into the thread's whole plan (see orchestrator-types.ts)
    // — look it up directly rather than assuming it's positional within
    // `run.plan`, since a follow-up's steps are appended, not re-indexed.
    const source = run.plan.find((s) => s.index === step.referenceFromStep);
    if (source?.outputUrl) {
      const sourceIsVideo = source.category === "video";
      const wantsVideoInput = model.mode === "v2v" || (model.mode === "enhance" && model.requiresVideoInput);
      if (sourceIsVideo && wantsVideoInput) {
        body.videoUrl = source.outputUrl;
      } else {
        body.references = [...userRefs, source.outputUrl];
      }
    }
  }

  const syntheticRequest = new Request("http://internal/api/orchestrator-step", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  try {
    const res = await handleGenerateRequest(step.category, syntheticRequest);
    const data = await res.json();
    if (!res.ok) {
      return { ...step, status: "failed", error: data?.error || "Failed to start this step" };
    }
    return { ...step, status: "running", generationId: data.id, error: null };
  } catch (err) {
    return { ...step, status: "failed", error: err instanceof Error ? err.message : "Failed to start this step" };
  }
}

/**
 * Approve a plan (or a follow-up's newly-added steps) and submit the first
 * pending one — called from the "Run it"/"Continue" action. Every
 * subsequent step is submitted by `advanceRun` below as the client keeps
 * polling. Finds the first *pending* step by scanning rather than assuming
 * index 0, since a follow-up on an already-partly-completed thread appends
 * new steps after ones that finished in an earlier turn.
 */
export async function startRun(supabase: SupabaseClient, userId: string, run: OrchestratorRun): Promise<OrchestratorRun> {
  const plan = [...run.plan];
  const startIndex = plan.findIndex((s) => s.status === "pending");
  if (startIndex === -1) {
    return persist(supabase, run.id, { status: "failed", plan, error: "This plan has no steps left to run." });
  }

  plan[startIndex] = await submitStep(userId, run, plan[startIndex]);
  if (plan[startIndex].status === "failed") {
    return persist(supabase, run.id, {
      status: "failed",
      plan,
      error: `Step ${startIndex + 1} (${plan[startIndex].label}): ${plan[startIndex].error}`,
    });
  }
  return persist(supabase, run.id, { status: "running", plan });
}

/**
 * Called on every poll while a run is "running": checks the currently
 * in-flight step's generation, and if it just settled, either submits the
 * next step or marks the whole run completed/failed. A no-op (returns the
 * run unchanged) if the in-flight step is still queued/processing.
 */
export async function advanceRun(
  supabase: SupabaseClient,
  userId: string,
  run: OrchestratorRun
): Promise<OrchestratorRun> {
  if (run.status !== "running") return run;

  const plan = [...run.plan];
  const currentIndex = plan.findIndex((s) => s.status === "running" || s.status === "pending");

  // Nothing left pending/running — every step resolved (shouldn't normally
  // be reached since the last step's own completion already flips the run
  // to "completed" below, but guards against a stuck state either way).
  if (currentIndex === -1) {
    return persist(supabase, run.id, { status: "completed", plan });
  }

  const current = plan[currentIndex];

  // Step hasn't been submitted yet (only true for index 0 right after
  // approval, if /run's own initial submit somehow didn't take) — submit it
  // now instead of leaving the run stalled forever.
  if (current.status === "pending") {
    plan[currentIndex] = await submitStep(userId, run, current);
    if (plan[currentIndex].status === "failed") {
      return persist(supabase, run.id, {
        status: "failed",
        plan,
        error: `Step ${currentIndex + 1} (${current.label}): ${plan[currentIndex].error}`,
      });
    }
    return persist(supabase, run.id, { plan });
  }

  // current.status === "running" — check on its generation.
  if (!current.generationId) {
    plan[currentIndex] = { ...current, status: "failed", error: "Lost track of this step's generation." };
    return persist(supabase, run.id, {
      status: "failed",
      plan,
      error: `Step ${currentIndex + 1} (${current.label}) lost its generation reference.`,
    });
  }

  const generation = await pollGenerationStatus(supabase, current.generationId);
  if (!generation || generation.status === "queued" || generation.status === "processing") {
    return run; // still in flight — nothing changed, next poll checks again
  }

  if (generation.status === "failed") {
    plan[currentIndex] = { ...current, status: "failed", error: generation.error || "Generation failed" };
    return persist(supabase, run.id, {
      status: "failed",
      plan,
      error: `Step ${currentIndex + 1} (${current.label}) failed: ${generation.error || "Generation failed"}`,
    });
  }

  // completed
  const outputUrl = generation.output_urls?.[0] ?? null;
  const actualCost = generation.cost_usd != null ? Number(generation.cost_usd) : current.costUsd;
  plan[currentIndex] = { ...current, status: "completed", outputUrl, costUsd: actualCost, error: null };

  const nextIndex = currentIndex + 1;
  if (nextIndex >= plan.length) {
    const totalCostUsd = plan.reduce((sum, s) => sum + (s.costUsd ?? 0), 0);
    return persist(supabase, run.id, {
      status: "completed",
      plan,
      total_cost_usd: Math.round(totalCostUsd * 1000) / 1000,
    });
  }

  plan[nextIndex] = await submitStep(userId, { ...run, plan }, plan[nextIndex]);
  if (plan[nextIndex].status === "failed") {
    return persist(supabase, run.id, {
      status: "failed",
      plan,
      error: `Step ${nextIndex + 1} (${plan[nextIndex].label}): ${plan[nextIndex].error}`,
    });
  }

  return persist(supabase, run.id, { plan });
}

async function persist(
  supabase: SupabaseClient,
  runId: string,
  patch: Partial<Pick<OrchestratorRun, "status" | "plan" | "error" | "total_cost_usd">>
): Promise<OrchestratorRun> {
  const { data } = await supabase.from("orchestrator_runs").update(patch).eq("id", runId).select().single();
  return data as OrchestratorRun;
}
