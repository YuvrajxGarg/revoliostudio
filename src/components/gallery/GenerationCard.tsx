"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeftRight, Brush, Check, Download, Eye, FolderPlus, Layers, AlertTriangle, Loader2, Maximize2, Music2, RefreshCw, Star, Trash2, MonitorPlay } from "lucide-react";
import type { Generation } from "@/lib/types";
import { useComposerStore } from "@/store/composerStore";
import { downloadImageAsPng, downloadFile, cn } from "@/lib/utils";
import { formatErrorMessage } from "@/lib/errorFormat";
import { deleteGeneration } from "@/lib/deleteGeneration";
import { retryGeneration } from "@/lib/retryGeneration";
import { createClient } from "@/lib/supabase/client";
import { GenerationDetailPanel } from "./GenerationDetailPanel";
import { InpaintModal } from "./InpaintModal";
import { CompareModal } from "./CompareModal";
import { ExpandModal } from "./ExpandModal";
import { VideoThumb } from "./VideoThumb";
import { ContextMenu, type ContextMenuItem } from "@/components/ui/ContextMenu";

const RIPPLE_GRID = 22;
// How long (s) the traveling wave takes to cross the field. Bigger = slower.
const RIPPLE_WAVE_SPAN = 3.2;

/**
 * In-progress indicator for queued/processing generation cards — a dense
 * field of tiny dots, edge-to-edge across the whole card, pulsing in an
 * organic halftone-style wave (reference: flowing halftone dot textures).
 * Replaces the old spinning Loader2 icon and the orange gradient sweep.
 *
 * Instead of a fixed radial ripple (always from the center), the wave sweeps
 * across in a *random direction chosen fresh each mount*, plus a per-dot
 * jitter and a secondary sine ripple, so no two loads look the same and the
 * front reads as a scattered organic wave rather than concentric rings. The
 * per-dot value just becomes `animation-delay` on the shared grow/fade
 * keyframe (.dot-ripple-item in globals.css); colors come from
 * `--foreground` at low opacity so it adapts to light/dark theme.
 */
function DotRippleLoader() {
  const dots = useMemo(() => {
    const angle = Math.random() * Math.PI * 2;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const arr: ReactNode[] = [];
    for (let row = 0; row < RIPPLE_GRID; row++) {
      for (let col = 0; col < RIPPLE_GRID; col++) {
        const nx = col / (RIPPLE_GRID - 1) - 0.5; // -0.5..0.5
        const ny = row / (RIPPLE_GRID - 1) - 0.5;
        const proj = (nx * dirX + ny * dirY + 0.71) / 1.42; // 0..1 along the wave dir
        const swirl = Math.sin((nx + ny) * Math.PI * 2) * 0.18; // organic waviness
        const jitter = Math.random() * 0.55; // breaks up the straight wavefront
        const delay = proj * RIPPLE_WAVE_SPAN + swirl + jitter;
        arr.push(
          <span key={`${row}-${col}`} className="dot-ripple-item" style={{ animationDelay: `${delay.toFixed(2)}s` }} />
        );
      }
    }
    return arr;
  }, []);
  return <div className="dot-ripple-grid">{dots}</div>;
}

function StatusOverlay({
  status,
  error,
  onDelete,
  onRetry,
  deleting,
  retrying,
  readOnly,
}: {
  status: Generation["status"];
  error: string | null;
  onDelete: (e: React.MouseEvent) => void;
  onRetry: (e: React.MouseEvent) => void;
  deleting: boolean;
  retrying: boolean;
  readOnly?: boolean;
}) {
  if (status === "completed") return null;
  if (status === "failed") {
    const formatted = formatErrorMessage(error);
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-center px-3 py-4">
        <AlertTriangle className="h-5 w-5 text-danger-text" />
        <span className="text-[11px] text-danger-text/90 line-clamp-3" title={formatted.details}>
          {formatted.message}
        </span>
        {!readOnly && (
          <div className="mt-1 flex items-center gap-1.5">
            <button
              onClick={onRetry}
              disabled={retrying || deleting}
              className="flex items-center gap-1 rounded-md bg-accent/90 hover:bg-accent px-2 py-1 text-[11px] font-medium text-white disabled:opacity-50"
            >
              {retrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Retry
            </button>
            <button
              onClick={onDelete}
              disabled={deleting || retrying}
              className="flex items-center gap-1 rounded-md bg-white/10 hover:bg-white/20 px-2 py-1 text-[11px] text-white disabled:opacity-50"
            >
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Delete
            </button>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="dot-ripple-overlay absolute inset-0">
      <DotRippleLoader />
    </div>
  );
}

function fileExt(url: string, fallback: string) {
  const match = url.split("?")[0].match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1] : fallback;
}

function studioName(generation: Generation): string {
  if (generation.seq_number) {
    return `revoliostudio_${String(generation.seq_number).padStart(3, "0")}`;
  }
  // Rows created before the numbering migration fall back to a short id.
  return `revoliostudio-${generation.id.slice(0, 8)}`;
}

export function GenerationCard({
  generation,
  onToolRun,
  onDeleted,
  onFavoriteToggle,
  onPreview,
  readOnly = false,
  selected = false,
  onToggleSelect,
  hasSelection = false,
  fill = false,
}: {
  generation: Generation;
  onToolRun?: () => void;
  onDeleted?: (id: string) => void;
  /** Fires after a favorite toggle actually succeeds, with the new value —
   * e.g. the Favorites view uses this to drop a card the moment it's
   * unfavorited instead of waiting for a refetch. */
  onFavoriteToggle?: (id: string, isFavorite: boolean) => void;
  /** Optional extra hover-toolbar action for a completed image (e.g. the
   * Thumbnail Generator's "Preview in feed" mockup) — omitted entirely when
   * not provided, so every other gallery keeps its current toolbar as-is. */
  onPreview?: (generation: Generation) => void;
  /** True for generations viewed via the Gallery's "Shared" tab — hides
   * delete controls the current user (not the owner) can't actually use. */
  readOnly?: boolean;
  /** Multi-select support (project filing). */
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  /** In GenerationGrid's justified-rows layout the parent computes each
   * card's exact box (width+height for the row) and the media just fills it
   * with object-cover. The card's own aspect ratio drives the box size, so
   * there's little to no crop. Off elsewhere (e.g. the detail viewer). */
  fill?: boolean;
  /** True when at least one card in the grid is currently selected — while
   * active, clicking anywhere on ANY card toggles its selection instead of
   * opening the detail viewer, so you can shift through a batch without the
   * viewer popping open on every click. */
  hasSelection?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [inpaintOpen, setInpaintOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [expandOpen, setExpandOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [favorite, setFavorite] = useState(!!generation.is_favorite);
  const [favoriting, setFavoriting] = useState(false);
  const prevStatusRef = useRef(generation.status);
  const addReference = useComposerStore((s) => s.addReference);
  const media = generation.output_urls[0];
  const outputCount = generation.output_urls?.length ?? 0;
  const openable = generation.status === "completed" || generation.status === "failed";

  // A small one-shot "pop" the moment a card actually finishes — this is the
  // only reliably satisfying feedback we can give for something that just
  // took anywhere from a few seconds to a couple minutes; without it a
  // generation just silently swaps from the orange processing shimmer to the
  // final thumbnail with no acknowledgment that anything happened. Only
  // fires on a real queued/processing → completed transition (checked
  // against the previous render's status, not just the current one), so it
  // never replays on a page refresh where a card loads in already completed.
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = generation.status;
    if (generation.status === "completed" && (prev === "queued" || prev === "processing")) {
      setJustCompleted(true);
      const t = setTimeout(() => setJustCompleted(false), 700);
      return () => clearTimeout(t);
    }
  }, [generation.status]);

  // Reset whenever the underlying media URL changes (a fresh generation, or
  // this card's row flipping from "processing" to "completed" for the first
  // time) so the placeholder holds until the new media has actually loaded.
  //
  // The fallback timer guards against browsers that never fire a "loaded"
  // event for a given <video>/<img> (flaky preload heuristics, slow/stalled
  // connections, etc) — without it a card could get stuck showing the
  // shimmer placeholder forever even though the media is perfectly fine and
  // opens fine in the detail view, only clearing on a full page refresh.
  useEffect(() => {
    setMediaLoaded(false);
    const fallback = setTimeout(() => setMediaLoaded(true), 4000);
    return () => clearTimeout(fallback);
  }, [media]);

  const isProcessing = generation.status === "queued" || generation.status === "processing";
  const isFailed = generation.status === "failed";
  // Completed with a media URL, but the browser hasn't finished loading the
  // actual image/video bytes yet — without this, the card would collapse to
  // near-zero height for a moment (no more aspect-square placeholder once
  // status flips to "completed", and an <img>/<video> has no intrinsic size
  // until it loads), reading as the card "disappearing and reappearing".
  const waitingOnMedia =
    generation.status === "completed" && !!media && generation.category !== "3d" && !mediaLoaded;

  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    if (!media || downloading) return;
    setDownloading(true);
    const base = studioName(generation);
    try {
      if (generation.category === "image") {
        await downloadImageAsPng(media, `${base}.png`);
      } else {
        const ext = fileExt(
          media,
          generation.category === "video" ? "mp4" : generation.category === "audio" ? "mp3" : "glb"
        );
        await downloadFile(media, `${base}.${ext}`);
      }
    } finally {
      setDownloading(false);
    }
  }

  async function handleToggleFavorite(e: React.MouseEvent) {
    e.stopPropagation();
    if (favoriting) return;
    const next = !favorite;
    setFavoriting(true);
    setFavorite(next); // optimistic — a star toggle should feel instant
    const supabase = createClient();
    const { error } = await supabase.from("generations").update({ is_favorite: next }).eq("id", generation.id);
    setFavoriting(false);
    if (error) {
      setFavorite(!next); // revert on failure
      return;
    }
    onFavoriteToggle?.(generation.id, next);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteGeneration(generation.id);
    if (result.ok) {
      onDeleted?.(generation.id);
    } else {
      setDeleting(false);
      setDeleteError(result.error ?? "Failed to delete");
    }
  }

  async function handleRetry(e: React.MouseEvent) {
    e.stopPropagation();
    if (retrying) return;
    setRetrying(true);
    const result = await retryGeneration(generation);
    if (result.ok) {
      // The old failed row is now superseded by a fresh queued one — drop it
      // from the gallery and pull the new one in via the parent's refetch.
      onDeleted?.(generation.id);
      deleteGeneration(generation.id).catch(() => {});
      onToolRun?.();
    } else {
      setRetrying(false);
      setDeleteError(result.error);
    }
  }

  // The card's action handlers all take a MouseEvent (to stopPropagation on
  // the card body); from the context menu there's no real event, so this
  // no-op stand-in lets them be reused without duplicating their logic.
  const noEvt = { stopPropagation() {}, preventDefault() {} } as unknown as React.MouseEvent;

  // Items for the right-click menu — mirrors the hover toolbar / detail-panel
  // tools so the same actions are reachable without opening the viewer.
  function buildMenuItems(): ContextMenuItem[] {
    const isImage = generation.category === "image";
    if (generation.status === "failed") {
      const items: ContextMenuItem[] = [];
      if (!readOnly) {
        items.push({ label: "Retry", icon: <RefreshCw className="h-4 w-4" />, onClick: () => handleRetry(noEvt) });
        items.push({ label: "Delete", icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => handleDelete(noEvt), separatorBefore: true });
      }
      return items;
    }
    const items: ContextMenuItem[] = [
      { label: "Open", icon: <Eye className="h-4 w-4" />, onClick: () => setOpen(true) },
      { label: "Compare", icon: <ArrowLeftRight className="h-4 w-4" />, onClick: () => setCompareOpen(true) },
    ];
    if (isImage) {
      items.push({ label: "Inpaint", icon: <Brush className="h-4 w-4" />, onClick: () => setInpaintOpen(true) });
      items.push({ label: "Generative Expand", icon: <Maximize2 className="h-4 w-4" />, onClick: () => setExpandOpen(true) });
      items.push({
        label: "Use as reference",
        icon: <Layers className="h-4 w-4" />,
        onClick: () => addReference(generation.thumbnail_url || media, generation.prompt || generation.model_label, 9),
      });
    }
    items.push({ label: "Download", icon: <Download className="h-4 w-4" />, onClick: () => handleDownload(noEvt), separatorBefore: true });
    if (!readOnly) {
      items.push({
        label: favorite ? "Unfavorite" : "Favorite",
        icon: <Star className={cn("h-4 w-4", favorite && "fill-current text-accent")} />,
        onClick: () => handleToggleFavorite(noEvt),
      });
      items.push({ label: "Delete", icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => handleDelete(noEvt), separatorBefore: true });
    }
    return items;
  }

  return (
    <>
      <div
        // In fill mode the parent (GenerationGrid's justified rows) has
        // already sized this card's box to the row height × the card's
        // aspect ratio, so the card just fills it — no intrinsic aspect
        // classes needed. Elsewhere the card sizes to its own media.
        className={cn(
          "relative overflow-hidden border border-border-subtle bg-surface group transition-colors",
          // Slightly rounded corners in the gallery grid (subtle, not the
          // full rounded-xl); the detail viewer and other non-grid usages
          // keep the softer radius.
          fill ? "rounded-md" : "rounded-xl",
          openable ? "cursor-pointer hover:border-accent/50" : "",
          fill && "h-full w-full",
          !fill && isProcessing && "aspect-square",
          !fill && isFailed && "aspect-square",
          // Same aspect-square placeholder sizing while the completed media
          // is still downloading — without it the card collapses to ~0
          // height for a moment (an unloaded <img>/<video> has no intrinsic
          // size), which read as the card vanishing and popping back in.
          !fill && waitingOnMedia && "shimmer aspect-square",
          fill && waitingOnMedia && "shimmer",
          justCompleted && "animate-generation-pop",
          // ring-inset, not a plain ring — a plain ring's 2px box-shadow
          // bleeds outward past the card's own box. That's invisible on the
          // Gallery grid (no tight ancestor clipping it), but Home wraps
          // this same grid in a `max-h-[…] overflow-hidden` preview panel
          // with zero padding, which clips that outward bleed on any card
          // touching the panel's edge — reading as a "broken"/partial
          // selection border. Drawing the ring inside the card's own bounds
          // means it can never be clipped by any ancestor's overflow.
          selected && "ring-2 ring-inset ring-accent"
        )}
        onClick={() => {
          if (!openable) return;
          // Selection mode is active as soon as anything in the grid is
          // checked — clicking the card body then toggles this card's
          // checkbox instead of popping the full-screen viewer open, so you
          // can select a run of generations without the viewer interrupting
          // every click.
          if (hasSelection && onToggleSelect) onToggleSelect(generation.id);
          else setOpen(true);
        }}
        onContextMenu={(e) => {
          // Replace the browser's default menu with our own tools menu — but
          // only for a finished card the user can actually act on.
          if (!openable) return;
          e.preventDefault();
          setMenuPos({ x: e.clientX, y: e.clientY });
        }}
      >
        {generation.status === "completed" && media ? (
          generation.category === "video" ? (
            <VideoThumb
              src={media}
              fill={fill}
              onLoaded={() => setMediaLoaded(true)}
              className={cn(
                "w-full object-cover block",
                fill ? "h-full absolute inset-0" : "h-auto",
                waitingOnMedia && "absolute inset-0 opacity-0"
              )}
            />
          ) : generation.category === "3d" ? (
            <div className={cn(
              "flex items-center justify-center bg-surface-2 text-muted text-xs px-2 text-center",
              fill ? "h-full w-full" : "aspect-square"
            )}>
              3D model ready — click to preview
            </div>
          ) : generation.category === "audio" ? (
            <div
              className={cn(
                "flex flex-col items-center justify-center gap-2.5 bg-surface-2 px-3 py-7 text-center",
                fill && "h-full w-full",
                waitingOnMedia && "opacity-0"
              )}
              // Native <audio> controls capture clicks (play/seek/volume) —
              // without stopping propagation, any interaction with them also
              // bubbles up to the card's own onClick and pops the detail
              // panel open mid-playback.
              onClick={(e) => e.stopPropagation()}
            >
              <Music2 className="h-6 w-6 text-muted" />
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio
                src={media}
                controls
                preload="metadata"
                onLoadedData={() => setMediaLoaded(true)}
                className="w-full max-w-[220px]"
              />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media}
              alt={generation.prompt}
              onLoad={() => setMediaLoaded(true)}
              className={cn(
                "w-full object-cover block",
                fill ? "h-full absolute inset-0" : "h-auto",
                waitingOnMedia && "absolute inset-0 opacity-0"
              )}
            />
          )
        ) : (
          <div className={fill ? "h-full w-full" : "aspect-square"} />
        )}

        <StatusOverlay
          status={generation.status}
          error={generation.error}
          onDelete={handleDelete}
          onRetry={handleRetry}
          deleting={deleting}
          retrying={retrying}
          readOnly={readOnly}
        />

        {generation.status === "completed" && (favorite || outputCount > 1) && (
          <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
            {/* Persistent (not hover-only) so a favorited card reads as
                favorited while just browsing the grid — the hover toolbar
                star below is what actually toggles it. */}
            {favorite && (
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-black/60 backdrop-blur-sm">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              </span>
            )}
            {outputCount > 1 && (
              <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm">
                ×{outputCount}
              </span>
            )}
          </div>
        )}

        {generation.author && (
          // Persistent (not hover-only) — only ever populated for the
          // Community feed / public profile pages (both readOnly), where
          // the select-checkbox below never renders, so this corner is
          // otherwise unused. Top-left, not bottom-left, deliberately: the
          // hover toolbar further down already owns the bottom band.
          <Link
            href={generation.author.username ? `/u/${generation.author.username}` : "#"}
            onClick={(e) => e.stopPropagation()}
            className="absolute left-2 top-2 z-10 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm px-2 py-1 hover:bg-black/80 transition-colors"
          >
            {generation.author.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={generation.author.avatar_url} alt="" className="h-4 w-4 rounded-full object-cover" />
            ) : (
              <div className="h-4 w-4 rounded-full accent-gradient" />
            )}
            <span className="text-[11px] font-medium text-white/90 truncate max-w-[100px]">
              {generation.author.display_name || generation.author.username}
            </span>
          </Link>
        )}

        {!readOnly && onToggleSelect && generation.status === "completed" && (
          <button
            title={selected ? "Deselect" : "Select"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(generation.id);
            }}
            className={cn(
              "absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-md border transition-opacity",
              selected
                ? "bg-accent border-accent text-white opacity-100"
                : cn(
                    "bg-black/40 border-white/60 text-transparent hover:border-white",
                    hasSelection ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )
            )}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        )}

        {generation.status === "completed" && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] text-white/90 truncate" title={generation.model_label}>
                {studioName(generation)}
              </span>
              <div className="flex items-center gap-1">
                {!readOnly && onToggleSelect && (
                  <button
                    title="Add to project"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(generation.id);
                    }}
                    className="p-1 rounded-md bg-white/10 hover:bg-white/20"
                  >
                    <FolderPlus className="h-3.5 w-3.5 text-white" />
                  </button>
                )}
                {!readOnly && (
                  <button
                    title={favorite ? "Remove from Favorites" : "Add to Favorites"}
                    onClick={handleToggleFavorite}
                    disabled={favoriting}
                    className="p-1 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-50"
                  >
                    <Star className={cn("h-3.5 w-3.5", favorite ? "fill-amber-400 text-amber-400" : "text-white")} />
                  </button>
                )}
                {generation.category === "image" && (
                  <button
                    title="Inpaint — paint over an area and describe the change"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInpaintOpen(true);
                    }}
                    className="p-1 rounded-md bg-white/10 hover:bg-white/20"
                  >
                    <Brush className="h-3.5 w-3.5 text-white" />
                  </button>
                )}
                {generation.category === "image" && onPreview && (
                  <button
                    title="Preview in feed"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPreview(generation);
                    }}
                    className="p-1 rounded-md bg-white/10 hover:bg-white/20"
                  >
                    <MonitorPlay className="h-3.5 w-3.5 text-white" />
                  </button>
                )}
                <button
                  title="Use as reference"
                  onClick={(e) => {
                    e.stopPropagation();
                    addReference(generation.thumbnail_url || media, generation.prompt || generation.model_label, 9);
                  }}
                  className="p-1 rounded-md bg-white/10 hover:bg-white/20"
                >
                  <Layers className="h-3.5 w-3.5 text-white" />
                </button>
                <button
                  title={generation.category === "image" ? "Download as PNG" : "Download"}
                  onClick={handleDownload}
                  disabled={downloading}
                  className="p-1 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-50"
                >
                  {downloading ? (
                    <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 text-white" />
                  )}
                </button>
                {!readOnly && (
                  <button
                    title="Delete"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="p-1 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-50"
                  >
                    {deleting ? (
                      <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5 text-white" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {deleteError && (
          <div className="absolute inset-x-0 bottom-0 z-10 bg-danger/90 px-2 py-1.5 text-[10px] text-white flex items-center justify-between gap-2">
            <span className="line-clamp-2">{deleteError}</span>
            <button onClick={() => setDeleteError(null)} className="shrink-0 opacity-80 hover:opacity-100">
              ✕
            </button>
          </div>
        )}
      </div>

      {open && (
        <GenerationDetailPanel
          generation={generation}
          onClose={() => setOpen(false)}
          onToolRun={onToolRun}
          onDeleted={onDeleted}
          readOnly={readOnly}
        />
      )}

      {inpaintOpen && media && (
        <InpaintModal
          imageUrl={media}
          onClose={() => setInpaintOpen(false)}
          onSubmitted={() => {
            setInpaintOpen(false);
            onToolRun?.();
          }}
        />
      )}

      {compareOpen && <CompareModal generation={generation} onClose={() => setCompareOpen(false)} />}

      {expandOpen && media && (
        <ExpandModal
          imageUrl={media}
          projectId={generation.project_id ?? null}
          onClose={() => setExpandOpen(false)}
          onSubmitted={() => {
            setExpandOpen(false);
            onToolRun?.();
          }}
        />
      )}

      {menuPos && (
        <ContextMenu x={menuPos.x} y={menuPos.y} onClose={() => setMenuPos(null)} items={buildMenuItems()} />
      )}
    </>
  );
}
