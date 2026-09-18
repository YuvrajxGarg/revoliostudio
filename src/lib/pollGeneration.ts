import type { SupabaseClient } from "@supabase/supabase-js";
import { getResult, extractOutputUrls, MuapiError } from "@/lib/muapi";
import type { Generation } from "@/lib/types";

// Safety net: if a job has been queued/processing longer than this with no
// resolution from muapi (including cases where muapi's poll endpoint keeps
// erroring, e.g. a content-policy rejection that never resolves to a clean
// {status:"failed"} body), stop polling forever and surface it as failed.
//
// The ceiling is per-category because completion times differ by an order of
// magnitude across model families: image/audio jobs are done in seconds-to-a-
// couple-minutes, but video (Seedance/Kling/etc.) and 3D (Meshy) routinely run
// well past 8 minutes on muapi — especially image-to-video and higher-res
// tiers. A single 8-minute global ceiling was force-failing video/3D jobs that
// muapi was still legitimately "processing", which is what surfaced as
// `Timed out waiting for muapi (still "processing" after 8 min)`.
const STALE_TIMEOUT_MS_BY_CATEGORY: Record<string, number> = {
  image: 8 * 60 * 1000,
  audio: 8 * 60 * 1000,
  video: 30 * 60 * 1000,
  "3d": 30 * 60 * 1000,
};
// Fallback for rows with an unexpected/missing category.
const DEFAULT_STALE_TIMEOUT_MS = 30 * 60 * 1000;

function staleTimeoutMs(category: unknown): number {
  if (typeof category === "string" && category in STALE_TIMEOUT_MS_BY_CATEGORY) {
    return STALE_TIMEOUT_MS_BY_CATEGORY[category];
  }
  return DEFAULT_STALE_TIMEOUT_MS;
}

/**
 * Poll muapi for one generation row's current status and persist any change
 * to the `generations` table, returning the (possibly updated) row.
 *
 * Extracted out of `/api/jobs/[id]/route.ts` so the exact same "is it done,
 * is it stuck, is it NSFW-flagged" logic can be reused by anything else that
 * needs to wait on a generation server-side without going through an HTTP
 * round trip to that route — currently just the Autopilot orchestrator,
 * which submits a run's steps one at a time and needs to know when the
 * current step's generation has actually finished before submitting the
 * next one.
 */
export async function pollGenerationStatus(
  // Typed loosely (not the generated Database type) since this file doesn't
  // import the full Supabase schema types — matches how the rest of this
  // codebase's server helpers (e.g. muapi.ts) stay schema-agnostic.
  supabase: SupabaseClient,
  id: string
): Promise<Generation | null> {
  const { data: row, error } = await supabase.from("generations").select("*").eq("id", id).single();
  if (error || !row) return null;

  if (row.status === "completed" || row.status === "failed") {
    return row as Generation;
  }

  const ageMs = Date.now() - new Date(row.created_at).getTime();
  const staleMs = staleTimeoutMs(row.category);

  if (!row.request_id) {
    if (ageMs > staleMs) {
      const { data: updated } = await supabase
        .from("generations")
        .update({ status: "failed", error: "muapi never returned a request id for this job." })
        .eq("id", id)
        .select()
        .single();
      return (updated ?? row) as Generation;
    }
    return row as Generation;
  }

  try {
    const result = await getResult(row.request_id);

    if (result.status === "completed") {
      const outputs = extractOutputUrls(result);
      const { data: updated } = await supabase
        .from("generations")
        .update({ status: "completed", output_urls: outputs, thumbnail_url: outputs[0] ?? null })
        .eq("id", id)
        .select()
        .single();
      return (updated ?? row) as Generation;
    }

    if (result.status === "failed" || result.status === "error") {
      const { data: updated } = await supabase
        .from("generations")
        .update({ status: "failed", error: result.error || "Generation failed on muapi." })
        .eq("id", id)
        .select()
        .single();
      return (updated ?? row) as Generation;
    }

    if (Array.isArray(result.has_nsfw_contents) && result.has_nsfw_contents.some(Boolean)) {
      const { data: updated } = await supabase
        .from("generations")
        .update({ status: "failed", error: "Blocked by muapi's content safety filter." })
        .eq("id", id)
        .select()
        .single();
      return (updated ?? row) as Generation;
    }

    if (ageMs > staleMs) {
      const { data: updated } = await supabase
        .from("generations")
        .update({
          status: "failed",
          error: `Timed out waiting for muapi (still "${result.status}" after ${Math.round(ageMs / 60000)} min).`,
        })
        .eq("id", id)
        .select()
        .single();
      return (updated ?? row) as Generation;
    }

    return row as Generation;
  } catch (err) {
    const message = err instanceof MuapiError ? err.message : "Failed to poll muapi";
    const status = err instanceof MuapiError ? err.status : 0;
    const isPermanent = status >= 400 && status < 500;

    if (isPermanent || ageMs > staleMs) {
      const { data: updated } = await supabase
        .from("generations")
        .update({ status: "failed", error: message })
        .eq("id", id)
        .select()
        .single();
      return (updated ?? row) as Generation;
    }

    return { ...row, error: message } as Generation;
  }
}
