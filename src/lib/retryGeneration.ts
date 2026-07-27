import type { Generation } from "@/lib/types";

/**
 * Re-submit a generation with the exact same parameters it was created with,
 * producing a fresh queued row. Used by the one-click "Retry" on failed
 * cards — a failed generation stores everything needed to run it again
 * (model, prompt, references, frames, settings, project, tool), so retry is
 * just POSTing those back to the same /api/generate/[category] route the
 * composers use.
 *
 * Note: start_frame_url / end_frame_url double as the videoUrl / character
 * inputs for the v2v and motion tools (see the insert in generate.ts), so
 * we send them back under both names — the route's buildPayload only
 * forwards whichever field the model's live schema actually exposes, so the
 * extra keys are harmless for models that don't use them.
 */
export async function retryGeneration(
  gen: Generation
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/generate/${gen.category}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelId: gen.model_id,
        prompt: gen.prompt ?? "",
        references: gen.reference_urls ?? [],
        startFrameUrl: gen.start_frame_url ?? undefined,
        endFrameUrl: gen.end_frame_url ?? undefined,
        videoUrl: gen.start_frame_url ?? undefined,
        characterImageUrl: gen.end_frame_url ?? undefined,
        settings: gen.settings ?? {},
        projectId: gen.project_id ?? null,
        toolId: gen.tool_id ?? null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || "Retry failed" };
    return { ok: true, id: data.id ?? data.generation?.id ?? "" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Retry failed" };
  }
}
