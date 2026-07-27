"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/lib/models";
import type { Generation, PublicProfile } from "@/lib/types";

const PAGE_SIZE = 24;

/**
 * Public Community/Explore feed — every generation whose owner opted to
 * publish it (is_public = true, see the 0027 migration's "anyone reads
 * published generations" RLS policy). No user scoping: this is the shared
 * showcase, readable even signed-out.
 */
export function useCommunityGenerations(category?: Category) {
  const [items, setItems] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  // Accumulates across pages so the same author's profile is only ever
  // fetched once per session, not once per page it happens to appear on.
  const authorsRef = useRef<Map<string, PublicProfile>>(new Map());

  const attachAuthors = useCallback(async (rows: Generation[]) => {
    const missing = [...new Set(rows.map((r) => r.user_id))].filter((id) => !authorsRef.current.has(id));
    if (missing.length > 0) {
      const supabase = createClient();
      const { data } = await supabase.rpc("get_public_profiles", { p_user_ids: missing });
      for (const p of (data ?? []) as PublicProfile[]) authorsRef.current.set(p.id, p);
    }
    return rows.map((r) => ({ ...r, author: authorsRef.current.get(r.user_id) ?? null }));
  }, []);

  const fetchPage = useCallback(
    async (page: number) => {
      const supabase = createClient();
      let q = supabase
        .from("generations")
        .select("*")
        .eq("is_public", true)
        .is("deleted_at", null)
        .eq("status", "completed")
        .order("published_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (category) q = q.eq("category", category);
      const { data } = await q;
      return (data ?? []) as Generation[];
    },
    [category]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    pageRef.current = 0;
    fetchPage(0)
      .then(attachAuthors)
      .then((rows) => {
        if (cancelled) return;
        setItems(rows);
        setHasMore(rows.length === PAGE_SIZE);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage, attachAuthors]);

  const loadMore = useCallback(async () => {
    const next = pageRef.current + 1;
    const rows = await fetchPage(next).then(attachAuthors);
    pageRef.current = next;
    setItems((prev) => [...prev, ...rows]);
    setHasMore(rows.length === PAGE_SIZE);
  }, [fetchPage, attachAuthors]);

  const removeItem = useCallback((id: string) => setItems((prev) => prev.filter((g) => g.id !== id)), []);

  return { items, loading, hasMore, loadMore, removeItem };
}
