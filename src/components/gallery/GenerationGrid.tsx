"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Folder, FolderPlus, Loader2, Trash2, X } from "lucide-react";
import { GenerationCard } from "./GenerationCard";
import { useProjects } from "@/hooks/useProjects";
import { createClient } from "@/lib/supabase/client";
import { deleteGeneration } from "@/lib/deleteGeneration";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import type { Generation } from "@/lib/types";
import type { ReactNode } from "react";

const GAP_PX = 4; // matches gap-1 — tight Higgsfield-style spacing

/** One card as placed by the justified-rows layout: the item plus the exact
 * pixel width it should render at (all cards in a row share `height`). */
interface PlacedItem {
  item: Generation;
  width: number;
}
interface JustifiedRow {
  height: number;
  items: PlacedItem[];
}

/**
 * Parse a generation's aspect ratio (width / height) for layout. Prefers the
 * stored `settings.aspectRatio` ("16:9", "9:16", "1:1", ...) since that's the
 * ratio the image was actually requested at; falls back to sane per-category
 * defaults, and clamps to a reasonable range so one freak panoramic/strip
 * result can't blow out a row.
 */
function aspectRatioOf(g: Generation): number {
  const raw = (g.settings as { aspectRatio?: string } | undefined)?.aspectRatio;
  let ar: number | null = null;
  if (raw && typeof raw === "string" && raw.includes(":")) {
    const [w, h] = raw.split(":").map(Number);
    if (w > 0 && h > 0) ar = w / h;
  }
  if (ar == null) {
    if (g.category === "audio") ar = 2.4; // audio player card — wide & short
    else if (g.category === "video") ar = 16 / 9;
    else ar = 1; // image / 3d default to square
  }
  return Math.min(3, Math.max(0.4, ar));
}

/**
 * Justified-rows layout — the Flickr / Google Photos / Higgsfield algorithm.
 *
 * This replaced both the old shortest-column masonry AND the uniform-square
 * grid. The problem with column masonry: it renders each column top-to-
 * bottom, so a newest-first list drops the newest card at the top of
 * whichever column was shortest — an arbitrary middle/right slot, never
 * reliably top-left. A uniform-square grid fixes ordering but forces every
 * card to the same size (loses aspect ratios). Justified rows gives both:
 * items are walked in DOM order (newest-first) and packed left-to-right into
 * rows; each row is then scaled to a single height that makes its items —
 * each kept at its true aspect ratio, so widths vary — exactly fill the
 * container width. Newest is always top-left, order is strictly row-major,
 * and a 4:3 shows up wider than a 9:16 in the same row (same height), which
 * is exactly what Higgsfield does.
 */
function useJustifiedRows(items: Generation[], targetHeight: number) {
  // Callback ref (not a plain ref + mount effect): the container lives behind
  // the loading / empty early-returns below, so it may mount only after those
  // flip. A callback ref re-fires whenever the node actually attaches, so the
  // observer always binds to a real element instead of latching onto null.
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    setContainerEl(node);
  }, []);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!containerEl) return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    ro.observe(containerEl);
    setContainerWidth(containerEl.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, [containerEl]);

  const rows = useMemo<JustifiedRow[]>(() => {
    if (!containerWidth || items.length === 0) return [];
    const out: JustifiedRow[] = [];
    let current: { item: Generation; ar: number }[] = [];
    let sumAr = 0;

    const flush = (isLast: boolean) => {
      if (current.length === 0) return;
      const gaps = (current.length - 1) * GAP_PX;
      const avail = containerWidth - gaps;
      // Height that makes this row's items exactly span the container.
      let h = avail / sumAr;
      // Don't upscale a trailing partial row into giant thumbnails — cap it
      // at the target so the last row sits at the same scale as the rest.
      if (isLast) h = Math.min(h, targetHeight);
      // Floor each width, then hand the leftover pixels to the last item so
      // the widths + gaps sum to EXACTLY the container width. Rounding each
      // independently could overspill by a few px and, under flex-nowrap,
      // show a stray horizontal scrollbar.
      const placed: PlacedItem[] = current.map(({ item, ar }) => ({ item, width: Math.floor(h * ar) }));
      if (!isLast) {
        const used = placed.reduce((s, p) => s + p.width, 0);
        const slack = Math.round(avail) - used;
        if (placed.length) placed[placed.length - 1].width += slack;
      }
      out.push({ height: Math.round(h), items: placed });
      current = [];
      sumAr = 0;
    };

    for (const item of items) {
      const ar = aspectRatioOf(item);
      current.push({ item, ar });
      sumAr += ar;
      const gaps = (current.length - 1) * GAP_PX;
      const avail = containerWidth - gaps;
      // Once the row, scaled to fill the width, would be no taller than the
      // target, it's "full" — close it and start the next.
      if (avail / sumAr <= targetHeight) flush(false);
    }
    flush(true); // whatever's left becomes the (capped) trailing row

    return out;
  }, [items, containerWidth, targetHeight]);

  return { containerRef, rows, ready: containerWidth > 0 };
}

export function GenerationGrid({
  items,
  loading,
  hasMore,
  onLoadMore,
  emptyLabel,
  emptyAction,
  onToolRun,
  onDeleted,
  onFavoriteToggle,
  onPreview,
  columnWidth = 220,
  readOnly = false,
}: {
  items: Generation[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  emptyLabel?: string;
  /** Optional quick-start control (e.g. "Try an example") rendered under the empty-state text — gives a first-time visitor one concrete action instead of just explaining what to do. */
  emptyAction?: ReactNode;
  /** Called after a post-generation tool (upscale, bg remove, ...) submits a new job. */
  onToolRun?: () => void;
  /** Called after a generation is deleted, with its id. */
  onDeleted?: (id: string) => void;
  /** Called after a card's favorite star is toggled — e.g. the Favorites
   * view uses this to drop a card the moment it's unfavorited. */
  onFavoriteToggle?: (id: string, isFavorite: boolean) => void;
  /** Optional extra per-card hover action — see GenerationCard's onPreview doc comment. */
  onPreview?: (generation: Generation) => void;
  /** Target thumbnail column width in px — wired to GridSizeSlider. */
  columnWidth?: number;
  /** True for the Gallery's "Shared" tab — hides delete controls on cards
   * the current user doesn't own. */
  readOnly?: boolean;
}) {
  // The size slider (columnWidth) now controls the target ROW HEIGHT — a
  // taller row means bigger thumbnails, same as a wider column did before.
  const { containerRef, rows, ready } = useJustifiedRows(items, columnWidth);

  // Infinite scroll: a sentinel div at the end of the grid auto-loads the
  // next page when it scrolls into view, replacing the old "Load more"
  // button. `rootMargin` fires it a bit before the sentinel is actually
  // visible so the next batch is usually already in by the time the user
  // reaches the bottom. Guarded on `loading` so a single scroll can't kick
  // off several overlapping fetches.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading) onLoadMore();
      },
      { rootMargin: "600px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, onLoadMore]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState(false);
  // Replaces native confirm() for both bulk delete and bulk project
  // add/remove — a plain click used to fire assignToProject immediately
  // with zero confirmation at all, which is worse than delete's old native
  // popup (at least that asked first). Both actions now route through the
  // same in-app modal.
  const [confirmAction, setConfirmAction] = useState<
    { type: "delete" } | { type: "assign"; projectId: string | null; projectName: string | null } | null
  >(null);
  const { projects } = useProjects();

  useEffect(() => setMounted(true), []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  async function assignToProject(projectId: string | null) {
    if (selectedIds.size === 0 || assigning) return;
    setAssigning(true);
    const supabase = createClient();
    await supabase
      .from("generations")
      .update({ project_id: projectId })
      .in("id", [...selectedIds]);
    setAssigning(false);
    setPickerOpen(false);
    setSelectedIds(new Set());
    setConfirmAction(null);
  }

  async function deleteSelected() {
    if (selectedIds.size === 0 || deletingBatch) return;
    setDeletingBatch(true);
    const ids = [...selectedIds];
    // Sequential rather than Promise.all — matches the same reasoning as
    // handleDownloadAll elsewhere (avoid hammering the delete endpoint /
    // storage bucket with a big burst of concurrent requests), and each
    // successful delete removes itself from selection immediately rather
    // than waiting for the whole batch to finish.
    for (const id of ids) {
      const result = await deleteGeneration(id);
      if (result.ok) {
        onDeleted?.(id);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }
    setDeletingBatch(false);
    setConfirmAction(null);
  }

  // Fires the actual mutation for whichever action the confirm modal is
  // currently showing — the modal itself is generic and doesn't know what
  // "confirm" means for a given action.
  function handleConfirm() {
    if (!confirmAction) return;
    if (confirmAction.type === "delete") deleteSelected();
    else assignToProject(confirmAction.projectId);
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-xl shimmer" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-muted">
        <p className="text-sm">{emptyLabel || "Nothing here yet — your generations will show up as you create."}</p>
        {emptyAction}
      </div>
    );
  }

  return (
    <div>
      {/* Justified rows (Flickr / Google Photos / Higgsfield). Items are
          walked in DOM order (newest-first) and packed left-to-right into
          rows; every row is scaled to one height that makes its items —
          each at its real aspect ratio, so a 4:3 is wider than a 9:16 in
          the same row — exactly fill the container width. Newest is always
          top-left, order is strictly row-major, and mixed aspect ratios are
          preserved. `ready` gates the first paint until the container width
          has been measured (rows can't be computed before then). */}
      <div ref={containerRef} className="flex flex-col gap-1">
        {ready &&
          rows.map((row, ri) => (
            <div key={ri} className="flex gap-1">
              {row.items.map(({ item, width }) => (
                <div key={item.id} className="flex-none" style={{ width, height: row.height }}>
                  <GenerationCard
                    generation={item}
                    fill
                    onToolRun={onToolRun}
                    onDeleted={onDeleted}
                    onFavoriteToggle={onFavoriteToggle}
                    onPreview={onPreview}
                    readOnly={readOnly}
                    selected={selectedIds.has(item.id)}
                    onToggleSelect={readOnly ? undefined : toggleSelect}
                    hasSelection={!readOnly && selectedIds.size > 0}
                  />
                </div>
              ))}
            </div>
          ))}
      </div>
      {/* Invisible sentinel — when it scrolls near the viewport the observer
          above auto-loads the next page. The small spinner shows only while
          a page is actually in flight. */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          {loading && <Loader2 className="h-5 w-5 animate-spin text-muted" />}
        </div>
      )}

      {/* Floating bulk-selection bar — portaled to <body> so the studios'
          blurred cards can't trap the fixed positioning. */}
      {mounted &&
        !readOnly &&
        selectedIds.size > 0 &&
        createPortal(
          <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-border-subtle bg-surface px-3 py-2 shadow-2xl">
            <span className="text-xs text-muted whitespace-nowrap">
              {selectedIds.size} selected
            </span>

            <div className="relative">
              <button
                onClick={() => setPickerOpen((v) => !v)}
                disabled={assigning}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-2 disabled:opacity-50"
              >
                {assigning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />}
                Add to project
              </button>
              {pickerOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-52 rounded-xl border border-border-subtle bg-surface p-1 shadow-2xl">
                  {projects.length === 0 && (
                    <div className="px-2.5 py-2 text-xs text-muted">
                      No projects yet — create one on the Projects page first.
                    </div>
                  )}
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setPickerOpen(false);
                        setConfirmAction({ type: "assign", projectId: p.id, projectName: p.name });
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs hover:bg-surface-2"
                    >
                      <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: p.color }} />
                      <span className="truncate">{p.name}</span>
                    </button>
                  ))}
                  <div className="my-1 border-t border-border-subtle" />
                  <button
                    onClick={() => {
                      setPickerOpen(false);
                      setConfirmAction({ type: "assign", projectId: null, projectName: null });
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-muted hover:bg-surface-2"
                  >
                    <X className="h-3.5 w-3.5" /> Remove from project
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setConfirmAction({ type: "delete" })}
              disabled={deletingBatch}
              className="flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-danger-text hover:bg-danger/20 disabled:opacity-50"
            >
              {deletingBatch ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete
            </button>

            <button
              onClick={() => {
                const completed = items.filter((g) => g.status === "completed").map((g) => g.id);
                setSelectedIds(new Set(completed));
              }}
              className="flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-xs hover:bg-border-subtle"
            >
              <Check className="h-3.5 w-3.5" /> Select all
            </button>
            <button
              onClick={() => {
                setSelectedIds(new Set());
                setPickerOpen(false);
              }}
              className="rounded-lg px-2 py-1.5 text-xs text-muted hover:text-foreground"
            >
              Clear
            </button>
          </div>,
          document.body
        )}

      {confirmAction && (
        <ConfirmModal
          title={
            confirmAction.type === "delete"
              ? `Delete ${selectedIds.size} generation${selectedIds.size > 1 ? "s" : ""}?`
              : confirmAction.projectId
                ? `Add ${selectedIds.size} generation${selectedIds.size > 1 ? "s" : ""} to "${confirmAction.projectName}"?`
                : `Remove ${selectedIds.size} generation${selectedIds.size > 1 ? "s" : ""} from its project?`
          }
          description={
            confirmAction.type === "delete"
              ? "This can't be undone."
              : confirmAction.projectId
                ? undefined
                : "They'll stay in your Library, just unfiled from any project."
          }
          confirmLabel={confirmAction.type === "delete" ? "Delete" : confirmAction.projectId ? "Add" : "Remove"}
          danger={confirmAction.type === "delete"}
          loading={confirmAction.type === "delete" ? deletingBatch : assigning}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
