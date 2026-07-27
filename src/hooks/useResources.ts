"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ResourceCategory = "editing" | "design" | "ai-tools" | "plugins" | "learning" | "stock";

export interface Resource {
  id: string;
  title: string;
  description: string;
  category: ResourceCategory;
  url: string;
  download_url: string | null;
  thumbnail_url: string | null;
  tags: string[];
  sort_order: number;
  created_at: string;
}

export interface ResourceInput {
  title: string;
  description: string;
  category: ResourceCategory;
  url: string;
  download_url?: string | null;
  thumbnail_url?: string | null;
  tags?: string[];
  sort_order?: number;
}

/** Admin-curated resources bank. Everyone reads; only admins write (RLS-enforced). */
export function useResources() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("resources")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    setResources((data ?? []) as Resource[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addResource = useCallback(async (input: ResourceInput) => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const { data, error } = await supabase
      .from("resources")
      .insert({ ...input, created_by: session?.user?.id ?? null })
      .select()
      .single();
    if (!error && data) setResources((prev) => [...prev, data as Resource]);
    return error?.message ?? null;
  }, []);

  const updateResource = useCallback(async (id: string, input: Partial<ResourceInput>) => {
    const supabase = createClient();
    const { error } = await supabase.from("resources").update(input).eq("id", id);
    if (!error) setResources((prev) => prev.map((r) => (r.id === id ? { ...r, ...input } as Resource : r)));
    return error?.message ?? null;
  }, []);

  const deleteResource = useCallback(async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("resources").delete().eq("id", id);
    if (!error) setResources((prev) => prev.filter((r) => r.id !== id));
    return error?.message ?? null;
  }, []);

  return { resources, loading, refresh, addResource, updateResource, deleteResource };
}
