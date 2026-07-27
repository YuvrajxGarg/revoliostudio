"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/lib/models";
import type { Generation } from "@/lib/types";

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
    fetchPage(0).then((rows) => {
      if (cancelled) return;
      setItems(rows);
      setHasMore(rows.length === PAGE_SIZE);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    const next = pageRef.current + 1;
    const rows = await fetchPage(next);
    pageRef.current = next;
    setItems((prev) => [...prev, ...rows]);
    setHasMore(rows.length === PAGE_SIZE);
  }, [fetchPage]);

  const removeItem = useCallback((id: string) => setItems((prev) => prev.filter((g) => g.id !== id)), []);

  return { items, loading, hasMore, loadMore, removeItem };
}
