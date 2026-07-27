"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/lib/models";
import type { ComposerSettings } from "@/store/composerStore";

export interface Template {
  id: string;
  user_id: string;
  name: string;
  category: Category;
  model_id: string;
  prompt: string;
  settings: Partial<ComposerSettings>;
  reference_urls: string[];
  thumbnail_url: string | null;
  created_at: string;
}

/** Saved composer setups (model + prompt + settings), per category. */
export function useTemplates(category: Category) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("templates")
      .select("*")
      .eq("category", category)
      .order("created_at", { ascending: false });
    setTemplates((data ?? []) as Template[]);
    setLoading(false);
  }, [category]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const saveTemplate = useCallback(
    async (t: {
      name: string;
      modelId: string;
      prompt: string;
      settings: Partial<ComposerSettings>;
      referenceUrls: string[];
      thumbnailUrl?: string | null;
    }) => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return null;
      const { data, error } = await supabase
        .from("templates")
        .insert({
          user_id: session.user.id,
          name: t.name,
          category,
          model_id: t.modelId,
          prompt: t.prompt,
          settings: t.settings,
          reference_urls: t.referenceUrls,
          thumbnail_url: t.thumbnailUrl ?? t.referenceUrls[0] ?? null,
        })
        .select()
        .single();
      if (!error && data) setTemplates((prev) => [data as Template, ...prev]);
      return (data as Template) ?? null;
    },
    [category]
  );

  const deleteTemplate = useCallback(async (id: string) => {
    const supabase = createClient();
    await supabase.from("templates").delete().eq("id", id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { templates, loading, refresh, saveTemplate, deleteTemplate };
}
