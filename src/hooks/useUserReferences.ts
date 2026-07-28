"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ImageRefCategory } from "./useCuratedReferences";

export interface UserReference {
  id: string;
  category: ImageRefCategory;
  name: string;
  image_url: string;
  source: "upload" | "generation";
  /** Character Sheet's generated shots for this saved character, if any —
   * empty for a plain style/location/element reference or a character saved
   * without a sheet. */
  shot_urls: string[];
  /** Character Sheet's composited poster (see characterSheetCompositor.ts),
   * uploaded to Storage at save time — null for anything saved without a
   * sheet. Preferred over `image_url` as the card preview when present. */
  poster_url: string | null;
  created_at: string;
}

export interface UserReferenceInput {
  category: ImageRefCategory;
  name: string;
  image_url: string;
  source?: "upload" | "generation";
  shot_urls?: string[];
  poster_url?: string;
}

/**
 * A signed-in user's own saved, named, reusable references — "my brand
 * style", "@sarah" — the persistent counterpart to curated_references.
 * Mirrors useResources.ts's shape, scoped to the current user via RLS.
 */
export function useUserReferences(category?: ImageRefCategory) {
  const [references, setReferences] = useState<UserReference[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    let query = supabase.from("user_references").select("*").order("created_at", { ascending: false });
    if (category) query = query.eq("category", category);
    const { data } = await query;
    setReferences((data ?? []) as UserReference[]);
    setLoading(false);
  }, [category]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveUserReference = useCallback(async (input: UserReferenceInput) => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return "You need to be signed in to save a reference.";
    const { data, error } = await supabase
      .from("user_references")
      .insert({ ...input, source: input.source ?? "upload", user_id: session.user.id })
      .select()
      .single();
    if (!error && data) setReferences((prev) => [data as UserReference, ...prev]);
    // Unique violation (same name reused in this category) — surface a friendlier message.
    if (error?.code === "23505") return `You already have a "${input.category}" reference named "${input.name}".`;
    return error?.message ?? null;
  }, []);

  const deleteUserReference = useCallback(async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("user_references").delete().eq("id", id);
    if (!error) setReferences((prev) => prev.filter((r) => r.id !== id));
    return error?.message ?? null;
  }, []);

  return { references, loading, refresh, saveUserReference, deleteUserReference };
}
