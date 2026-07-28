"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ImageRefCategory = "style" | "character" | "location" | "element";
export type RefCategory = ImageRefCategory | "camera" | "effects" | "color";

export interface CuratedReference {
  id: string;
  category: RefCategory;
  name: string;
  image_url: string | null;
  thumbnail_url: string | null;
  prompt_modifier: string | null;
  swatch_colors: string[];
  tags: string[];
  sort_order: number;
  /** Character-category only — see useUserReferences' characterAssetUrls,
   * copied over at publish time (0037_curated_character_publishing.sql). */
  shot_urls: string[];
  poster_url: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CuratedReferenceInput {
  category: RefCategory;
  name: string;
  image_url?: string | null;
  thumbnail_url?: string | null;
  prompt_modifier?: string | null;
  swatch_colors?: string[];
  tags?: string[];
  sort_order?: number;
  shot_urls?: string[];
  poster_url?: string | null;
}

/**
 * Admin-curated "By Revolio" picks for the Reference Library — everyone
 * browses (RLS: authenticated read), only admins add/edit/remove entries.
 * Mirrors useResources.ts's shape exactly.
 */
export function useCuratedReferences(category?: RefCategory) {
  const [references, setReferences] = useState<CuratedReference[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    let query = supabase
      .from("curated_references")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (category) query = query.eq("category", category);
    const { data } = await query;
    setReferences((data ?? []) as CuratedReference[]);
    setLoading(false);
  }, [category]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addCuratedReference = useCallback(async (input: CuratedReferenceInput) => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const { data, error } = await supabase
      .from("curated_references")
      .insert({ ...input, created_by: session?.user?.id ?? null })
      .select()
      .single();
    if (!error && data) setReferences((prev) => [...prev, data as CuratedReference]);
    return error?.message ?? null;
  }, []);

  const updateCuratedReference = useCallback(async (id: string, input: Partial<CuratedReferenceInput>) => {
    const supabase = createClient();
    const { error } = await supabase.from("curated_references").update(input).eq("id", id);
    if (!error)
      setReferences((prev) => prev.map((r) => (r.id === id ? ({ ...r, ...input } as CuratedReference) : r)));
    return error?.message ?? null;
  }, []);

  const deleteCuratedReference = useCallback(async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("curated_references").delete().eq("id", id);
    if (!error) setReferences((prev) => prev.filter((r) => r.id !== id));
    return error?.message ?? null;
  }, []);

  return { references, loading, refresh, addCuratedReference, updateCuratedReference, deleteCuratedReference };
}
