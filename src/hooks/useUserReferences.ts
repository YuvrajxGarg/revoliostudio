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
  /** Set once this character has been published to the shared Character
   * Library (curated_references) — the id of that row, so it can be
   * unpublished later. Null if never published. */
  published_curated_id: string | null;
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
 * A saved character's own generated reference — just the composited poster,
 * as a single-item list (or empty if this character was saved without ever
 * generating a sheet; callers should fall back to `image_url` themselves in
 * that case).
 *
 * Used to attach ONE reference per character-tag instead of many: an
 * earlier version of this also attached every individual shot alongside the
 * poster, but handing a generation ~10-25 separate images to reconcile
 * produced noisier, less identity-consistent results than one dense,
 * information-rich poster image (see characterSheetCompositor.ts — it now
 * renders text-free specifically so this single image reads clearly as a
 * reference). Deliberately excludes `image_url` (the plain uploaded face
 * photo used to make the sheet) for the same reason it always did — once a
 * sheet exists, the poster is the useful "this is the character" reference,
 * not the raw source selfie.
 */
export function characterAssetUrls(r: Pick<UserReference, "poster_url">): string[] {
  return r.poster_url ? [r.poster_url] : [];
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

  // Copies a saved character into curated_references (category "character")
  // so it shows up for every signed-in user under Library's "By Revolio" —
  // RLS (0037_curated_character_publishing.sql) only lets this succeed for
  // category "character" with created_by = the caller's own id; every other
  // curated category stays admin-only, unchanged.
  const publishCharacter = useCallback(async (ref: UserReference) => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return "You need to be signed in to publish a character.";
    const { data, error } = await supabase
      .from("curated_references")
      .insert({
        category: "character",
        name: ref.name,
        image_url: ref.image_url,
        shot_urls: ref.shot_urls,
        poster_url: ref.poster_url,
        created_by: session.user.id,
      })
      .select()
      .single();
    if (error || !data) return error?.message ?? "Failed to publish this character.";
    const { error: linkError } = await supabase
      .from("user_references")
      .update({ published_curated_id: data.id })
      .eq("id", ref.id);
    if (!linkError) {
      setReferences((prev) => prev.map((r) => (r.id === ref.id ? { ...r, published_curated_id: data.id } : r)));
    }
    return linkError?.message ?? null;
  }, []);

  const unpublishCharacter = useCallback(async (ref: UserReference) => {
    if (!ref.published_curated_id) return null;
    const supabase = createClient();
    // Deleting the curated row first is deliberate — RLS on it only allows
    // the publisher to delete their own (see the same migration), so this
    // has to run as this user's own delete, not a cascade from the side
    // that has no RLS check of its own.
    await supabase.from("curated_references").delete().eq("id", ref.published_curated_id);
    const { error } = await supabase.from("user_references").update({ published_curated_id: null }).eq("id", ref.id);
    if (!error) setReferences((prev) => prev.map((r) => (r.id === ref.id ? { ...r, published_curated_id: null } : r)));
    return error?.message ?? null;
  }, []);

  return {
    references,
    loading,
    refresh,
    saveUserReference,
    deleteUserReference,
    publishCharacter,
    unpublishCharacter,
  };
}
