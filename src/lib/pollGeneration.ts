import type { SupabaseClient } from "@supabase/supabase-js";
import { getResult, extractOutputUrls, MuapiError } from "@/lib/muapi";
import type { Generation } from "@/lib/types";

// Safety net: if a job has been queued/processing longer than this with no
// resolution from muapi (including cases where muapi's poll endpoint keeps
// erroring, e.g. a content-policy rejection that never resolves to a clean
// {status:"failed"} body), stop polling forever and surface it as failed.
const STALE_TIMEOUT_MS = 8 * 60 * 1000;

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

  if (!row.request_id) {
    if (ageMs > STALE_TIMEOUT_MS) {
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

    if (ageMs > STALE_TIMEOUT_MS) {
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

    if (isPermanent || ageMs > STALE_TIMEOUT_MS) {
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
