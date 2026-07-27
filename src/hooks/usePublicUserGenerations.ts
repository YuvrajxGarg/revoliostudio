"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Generation } from "@/lib/types";

const PAGE_SIZE = 24;

/**
 * A single user's published work, for the public /u/[username] profile page.
 * Same shape as useCommunityGenerations but scoped to one owner instead of
 * the global feed — needs no new RPC since is_public rows are already
 * publicly readable per the 0027 migration's RLS policy.
 */
export function usePublicUserGenerations(profileId: string | null) {
  const [items, setItems] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);

  const fetchPage = useCallback(
    async (page: number) => {
      if (!profileId) return [];
      const supabase = createClient();
      const { data } = await supabase
        .from("generations")
        .select("*")
        .eq("user_id", profileId)
        .eq("is_public", true)
        .is("deleted_at", null)
        .eq("status", "completed")
        .order("published_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      return (data ?? []) as Generation[];
    },
    [profileId]
  );

  useEffect(() => {
    if (!profileId) {
      setItems([]);
      setLoading(false);
      return;
    }
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
  }, [fetchPage, profileId]);

  const loadMore = useCallback(async () => {
    const next = pageRef.current + 1;
    const rows = await fetchPage(next);
    pageRef.current = next;
    setItems((prev) => [...prev, ...rows]);
    setHasMore(rows.length === PAGE_SIZE);
  }, [fetchPage]);

  return { items, loading, hasMore, loadMore };
}
