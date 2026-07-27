"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/lib/models";
import type { Generation } from "@/lib/types";

const PAGE_SIZE = 24;
const POLL_INTERVAL_MS = 1500;

// Module-level cache: every studio page fully unmounts on navigation (each
// is a separate route leaf), so this hook used to reset to `loading: true`
// and refetch from scratch every time you switched pages — the "loader
// then previews pop in" flash when going e.g. Image -> Video -> Image.
// Keying the last-fetched page of results by category+filters here (outside
// React state, so it survives the unmount) lets a returning page paint
// last-known results immediately while it revalidates in the background.
// Session-lifetime only — cleared on a full page reload, which is fine
// since a fresh load has nothing stale to show anyway.
const galleryCache = new Map<string, Generation[]>();

function cacheKey(category: Category | undefined, filters: GenerationFilters | undefined) {
  return JSON.stringify([
    category ?? null,
    filters?.projectId ?? null,
    filters?.search ?? "",
    filters?.modelIds?.join(",") ?? "",
    filters?.toolId === undefined ? "u" : filters.toolId,
    !!filters?.favoritesOnly,
    !!filters?.trashed,
    !!filters?.allowTeamMembers,
    filters?.createdAfter ?? "",
    filters?.createdBefore ?? "",
    filters?.aspectRatio ?? "",
  ]);
}

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
  const key = cacheKey(category, filters);
  const [items, setItems] = useState<Generation[]>(() => galleryCache.get(key) ?? []);
  const [loading, setLoading] = useState(() => !galleryCache.has(key));
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const itemsRef = useRef<Generation[]>([]);
  itemsRef.current = items;
  // Only the very first effect run should trust the lazy `useState` init
  // above (it already read the cache) — later reruns, triggered by the
  // category/filters actually changing while this instance stays mounted,
  // need to re-check the cache for the *new* key themselves.
  const firstRunRef = useRef(true);
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
    if (firstRunRef.current) {
      firstRunRef.current = false;
    } else {
      const cached = galleryCache.get(key);
      setItems(cached ?? []);
      setLoading(!cached);
    }
    pageRef.current = 0;
    fetchPage(0).then((data) => {
      if (cancelled) return;
      setItems(data);
      setHasMore(data.length === PAGE_SIZE);
      setLoading(false);
      galleryCache.set(key, data);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPage, key]);

  const loadMore = useCallback(async () => {
    const next = pageRef.current + 1;
    const data = await fetchPage(next);
    pageRef.current = next;
    setItems((prev) => [...prev, ...data]);
    setHasMore(data.length === PAGE_SIZE);
  }, [fetchPage]);

  // These three also write through to the module cache (keeping it fresh,
  // not just seeding it on fetch) so a quick nav-away-and-back doesn't
  // briefly resurrect a just-deleted item or hide a just-submitted one
  // before the background revalidation fetch lands.
  const prepend = useCallback(
    (item: Generation) => {
      setItems((prev) => {
        const next = [item, ...prev.filter((p) => p.id !== item.id)];
        galleryCache.set(key, next);
        return next;
      });
    },
    [key]
  );

  const removeItem = useCallback(
    (id: string) => {
      setItems((prev) => {
        const next = prev.filter((p) => p.id !== id);
        galleryCache.set(key, next);
        return next;
      });
    },
    [key]
  );

  const pollOne = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/jobs/${id}`);
        if (!res.ok) return;
        const updated = (await res.json()) as Generation;
        setItems((prev) => {
          const next = prev.map((g) => (g.id === updated.id ? updated : g));
          galleryCache.set(key, next);
          return next;
        });
      } catch {
        // ignore transient errors, next tick will retry
      }
    },
    [key]
  );

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
