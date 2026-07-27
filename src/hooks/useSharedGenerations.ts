"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Generation } from "@/lib/types";

/**
 * Generations other users have shared with the current user — powers the
 * Gallery's "Shared" tab. Backed by /api/shares rather than a direct
 * Supabase query since assembling each item (generation + sender profile)
 * needs a couple of joined lookups that are simplest done server-side.
 */
export function useSharedGenerations() {
  const [items, setItems] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);

  const fetchPage = useCallback(async (page: number) => {
    const res = await fetch(`/api/shares?page=${page}`);
    if (!res.ok) return { shares: [] as Generation[], hasMore: false };
    const data = (await res.json()) as { shares?: Generation[]; hasMore?: boolean };
    return { shares: data.shares ?? [], hasMore: !!data.hasMore };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    pageRef.current = 0;
    fetchPage(0).then(({ shares, hasMore }) => {
      if (cancelled) return;
      setItems(shares);
      setHasMore(hasMore);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    const next = pageRef.current + 1;
    const { shares, hasMore } = await fetchPage(next);
    pageRef.current = next;
    setItems((prev) => [...prev, ...shares]);
    setHasMore(hasMore);
  }, [fetchPage]);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { items, loading, hasMore, loadMore, removeItem };
}
