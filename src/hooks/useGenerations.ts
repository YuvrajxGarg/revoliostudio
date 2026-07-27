"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/lib/models";
import type { Generation } from "@/lib/types";

const PAGE_SIZE = 24;
const POLL_INTERVAL_MS = 1500;

export interface GenerationFilters {
  /** Only rows tagged with this project. `null`/undefined = no filter. */
  projectId?: string | null;
  /** Case-insensitive substring match against the prompt. */
  search?: string;
  /** Only rows made with one of these model ids — powers a single tool's own gallery (e.g. Headshot Studio only shows its own results, not every image generation). */
  modelIds?: string[];
  /**
   * Scopes by which surface actually created the row (see `tool_id` on
   * `Generation`): a tool slug (e.g. "stickers") shows only that tool
   * studio's own output; `null` shows only the plain Image/Video/Audio/3D
   * Generator's output (`tool_id IS NULL`); `undefined` (the default)
   * applies no filter at all. This is what keeps generations from one tool
   * studio (or the plain generator) out of every other surface that
   * happens to share the same underlying model — previously galleries were
   * scoped by `modelIds` alone, which doesn't distinguish "made by this
   * tool" from "made with a model this tool also uses".
   */
  toolId?: string | null;
  /** Only favorited rows — powers the Projects page's "Favorites" view. */
  favoritesOnly?: boolean;
  /** Gallery filter bar: only rows created on/after this ISO date. */
  createdAfter?: string;
  /** Gallery filter bar: only rows created on/before this ISO date (end of day). */
  createdBefore?: string;
  /** Gallery filter bar: only rows whose settings.aspectRatio equals this (e.g. "16:9"). */
  aspectRatio?: string;
  /** Shows Trash instead of the normal live view: only soft-deleted rows
   * (deleted_at IS NOT NULL), newest-deleted first. Default (false/undefined)
   * excludes trashed rows entirely, same as before Trash existed. */
  trashed?: boolean;
  /**
   * When a `projectId` is given and that project is a "team" project, drop
   * the hard `.eq("user_id", ...)` scoping so teammates' generations (not
   * just your own) show up too — RLS (see 0025's "team members read project
   * generations" policy) is what actually governs who can see what; this
   * flag just stops the client from pre-filtering rows down to "mine only"
   * before RLS even gets a say. Leave unset everywhere else (Home, the
   * plain Gallery, tool studios) so those stay scoped to your own work.
   */
  allowTeamMembers?: boolean;
}

export function useGenerations(category?: Category, filters?: GenerationFilters) {
  const [items, setItems] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const itemsRef = useRef<Generation[]>([]);
  itemsRef.current = items;
  // Admin accounts can *see* every user's rows via RLS (for the Admin panel),
  // but this hook powers each person's own Studio/Gallery — so we always
  // scope explicitly to the signed-in user rather than relying on RLS alone.
  const userIdRef = useRef<string | null>(null);

  const fetchPage = useCallback(
    async (page: number) => {
      const supabase = createClient();
      if (!userIdRef.current) {
        // `getSession()` reads the already-verified session from local
        // storage with no network round-trip, unlike `getUser()` which
        // re-validates against the Auth server every call — that extra
        // round-trip was firing on every single page mount (Studio/Gallery
        // remount on each navigation) and was a big chunk of the "page
        // switching is slow" complaint. This is safe here because the id is
        // only used for an explicit `.eq("user_id", ...)` filter for UX —
        // Postgres RLS (keyed off the verified JWT sent with the request,
        // not this client-read value) remains the real security boundary.
        const {
          data: { session },
        } = await supabase.auth.getSession();
        userIdRef.current = session?.user?.id ?? null;
      }
      if (!userIdRef.current) return [];

      // See `allowTeamMembers` doc comment on GenerationFilters — only skip
      // the "mine only" filter for a team project's shared view; every
      // other caller keeps the exact scoping it always had.
      const scopeToOwnUser = !(filters?.allowTeamMembers && filters?.projectId);

      function buildQuery(includeTrashColumns: boolean) {
        let q = supabase
          .from("generations")
          .select("*")
          .order("created_at", { ascending: false })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
        if (scopeToOwnUser) q = q.eq("user_id", userIdRef.current!);
        if (includeTrashColumns) {
          q = filters?.trashed ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
          if (filters?.favoritesOnly) q = q.eq("is_favorite", true);
        }
        if (category) q = q.eq("category", category);
        if (filters?.projectId) q = q.eq("project_id", filters.projectId);
        if (filters?.search?.trim()) {
          // "Semantic-ish" search with no AI cost: match the prompt OR the
          // model label, so typing "banana" finds Nano-Banana output and
          // typing a subject finds it in the prompt. Commas are escaped
          // since PostgREST's `or` filter is comma-delimited.
          const term = filters.search.trim().replace(/,/g, "");
          q = q.or(`prompt.ilike.%${term}%,model_label.ilike.%${term}%`);
        }
        if (filters?.modelIds && filters.modelIds.length > 0) q = q.in("model_id", filters.modelIds);
        if (filters?.toolId !== undefined) {
          q = filters.toolId === null ? q.is("tool_id", null) : q.eq("tool_id", filters.toolId);
        }
        if (filters?.createdAfter) q = q.gte("created_at", filters.createdAfter);
        if (filters?.createdBefore) q = q.lte("created_at", filters.createdBefore);
        if (filters?.aspectRatio) q = q.eq("settings->>aspectRatio", filters.aspectRatio);
        return q;
      }

      const { data, error } = await buildQuery(true);
      if (error) {
        // The `deleted_at`/`is_favorite` columns (0025 migration) aren't
        // live yet in this project — rather than showing an empty gallery
        // (which reads as "my generations got deleted"), fall back to the
        // pre-migration query so existing work stays visible. Trash/Favorites
        // views will just come up empty until the migration actually lands.
        console.warn(
          "useGenerations: query with deleted_at/is_favorite failed, falling back — run supabase/migrations/0025_projects_team_trash.sql if this persists.",
          error.message
        );
        if (filters?.trashed || filters?.favoritesOnly) return [];
        const fallback = await buildQuery(false);
        return (fallback.data ?? []) as Generation[];
      }
      return (data ?? []) as Generation[];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      category,
      filters?.projectId,
      filters?.search,
      filters?.modelIds?.join(","),
      filters?.toolId,
      filters?.favoritesOnly,
      filters?.trashed,
      filters?.allowTeamMembers,
      filters?.createdAfter,
      filters?.createdBefore,
      filters?.aspectRatio,
    ]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    pageRef.current = 0;
    fetchPage(0).then((data) => {
      if (cancelled) return;
      setItems(data);
      setHasMore(data.length === PAGE_SIZE);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    const next = pageRef.current + 1;
    const data = await fetchPage(next);
    pageRef.current = next;
    setItems((prev) => [...prev, ...data]);
    setHasMore(data.length === PAGE_SIZE);
  }, [fetchPage]);

  const prepend = useCallback((item: Generation) => {
    setItems((prev) => [item, ...prev.filter((p) => p.id !== item.id)]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const pollOne = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/jobs/${id}`);
      if (!res.ok) return;
      const updated = (await res.json()) as Generation;
      setItems((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    } catch {
      // ignore transient errors, next tick will retry
    }
  }, []);

  // Poll any in-flight generations for status updates.
  useEffect(() => {
    const interval = setInterval(async () => {
      const pending = itemsRef.current.filter(
        (g) => g.status === "queued" || g.status === "processing"
      );
      if (pending.length === 0) return;
      await Promise.all(pending.map((g) => pollOne(g.id)));
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [pollOne]);

  return { items, loading, hasMore, loadMore, prepend, removeItem, pollNow: pollOne };
}
