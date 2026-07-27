/**
 * "Delete" a generation — moves it to Trash rather than removing the row,
 * so it can be restored later (see restoreGeneration/permanentlyDeleteGeneration
 * below, and TrashView). Guards against the classic Supabase RLS gotcha: if
 * an UPDATE is blocked by a missing/mismatched RLS policy, PostgREST returns
 * success with zero rows affected instead of an error — so a naive
 * `.update(...).eq(...)` looks like it worked even though nothing happened.
 * We ask Postgres to return the updated row(s) and treat an empty result as
 * a failure, so the UI never optimistically removes something that's still
 * sitting un-trashed in the database (which is what caused deleted items to
 * "come back" after a refresh, back when this was a hard delete).
 */
export async function deleteGeneration(id: string): Promise<{ ok: boolean; error?: string }> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("generations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: "Delete was blocked (no row was actually removed) — the Trash migration may not be applied yet.",
    };
  }
  return { ok: true };
}

/** Pulls a generation back out of Trash. */
export async function restoreGeneration(id: string): Promise<{ ok: boolean; error?: string }> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("generations")
    .update({ deleted_at: null })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "Restore was blocked — nothing was updated." };
  return { ok: true };
}

/** Permanently removes a generation row — only meaningful from Trash, where
 * the item is already soft-deleted. This is the real, irreversible delete. */
export async function permanentlyDeleteGeneration(id: string): Promise<{ ok: boolean; error?: string }> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { data, error } = await supabase.from("generations").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "Delete was blocked — nothing was removed." };
  return { ok: true };
}
