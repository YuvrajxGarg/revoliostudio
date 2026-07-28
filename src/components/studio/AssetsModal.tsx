"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Image as ImageIcon, Clapperboard, Heart, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGenerations } from "@/hooks/useGenerations";
import { useUserReferences } from "@/hooks/useUserReferences";
import { GenerationGrid } from "@/components/gallery/GenerationGrid";

type AssetsTab = "uploads" | "image" | "video" | "liked";

const TABS: { id: AssetsTab; label: string; icon: typeof ImageIcon }[] = [
  { id: "uploads", label: "Uploads", icon: Upload },
  { id: "image", label: "Image Generations", icon: ImageIcon },
  { id: "video", label: "Video Generations", icon: Clapperboard },
  { id: "liked", label: "Liked", icon: Heart },
];

/**
 * Uploads tab is backed by `user_references` (source === "upload") — Revolio
 * doesn't keep a generic "every file you ever uploaded" bucket, only the ones
 * a user chose to save+name as a Style/Character/Location/Element (see
 * useUserReferences' doc comment). That's the closest real equivalent to
 * Higgsfield's Uploads tab without inventing new storage.
 */
function UploadsGrid({ onPick }: { onPick?: (url: string) => void }) {
  const { references, loading } = useUserReferences();
  const uploads = references.filter((r) => r.source === "upload");

  if (loading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-xl shimmer" />
        ))}
      </div>
    );
  }
  if (uploads.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-24 text-center text-muted">
        <Upload className="h-6 w-6" />
        <p className="text-sm max-w-[16rem]">
          No saved uploads yet — save a Style, Character, Location, or Element from any composer to see it here.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
      {uploads.map((r) => (
        <button
          key={r.id}
          onClick={() => onPick?.(r.image_url)}
          disabled={!onPick}
          title={r.name}
          className={cn(
            "group flex flex-col gap-1 text-left",
            onPick ? "cursor-pointer" : "cursor-default"
          )}
        >
          <div
            className={cn(
              "aspect-square overflow-hidden rounded-xl border border-border-subtle bg-surface-2 transition-colors",
              onPick && "group-hover:border-accent/50"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.image_url} alt={r.name} className="h-full w-full object-cover" />
          </div>
          <span className="truncate text-[11px] text-muted">{r.name}</span>
        </button>
      ))}
    </div>
  );
}

/** Pick-mode grid for the two generation tabs — plain thumbnail buttons
 * instead of the full interactive GenerationGrid, since GenerationCard's
 * click always opens the detail viewer rather than notifying a picker. */
function GenerationPickGrid({ tab, onPick }: { tab: "image" | "video" | "liked"; onPick: (url: string) => void }) {
  const { items, loading } = useGenerations(
    tab === "liked" ? undefined : tab,
    tab === "liked" ? { favoritesOnly: true } : undefined
  );
  const usable = items.filter((g) => g.status === "completed" && g.thumbnail_url);

  if (loading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-xl shimmer" />
        ))}
      </div>
    );
  }
  if (usable.length === 0) {
    return <p className="py-24 text-center text-sm text-muted">Nothing here yet.</p>;
  }
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
      {usable.map((g) => (
        <button
          key={g.id}
          onClick={() => onPick(g.thumbnail_url!)}
          title={g.prompt}
          className="group aspect-square overflow-hidden rounded-xl border border-border-subtle bg-surface-2 transition-colors hover:border-accent/50"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={g.thumbnail_url!} alt="" className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  );
}

/** Browse-mode view for the two generation tabs — the real GenerationGrid,
 * with favoriting/delete/open-detail all working exactly like every other
 * gallery in the app. */
function GenerationBrowseGrid({ tab }: { tab: "image" | "video" | "liked" }) {
  const { items, loading, hasMore, loadMore, removeItem } = useGenerations(
    tab === "liked" ? undefined : tab,
    tab === "liked" ? { favoritesOnly: true } : undefined
  );
  return (
    <GenerationGrid
      items={items}
      loading={loading}
      hasMore={hasMore}
      onLoadMore={loadMore}
      onDeleted={removeItem}
      emptyLabel={tab === "liked" ? "Nothing liked yet — star a generation to save it here." : "Nothing here yet."}
      columnWidth={160}
    />
  );
}

/**
 * Pilot's Assets panel — Higgsfield's Assets/Gallery modal, tabbed across
 * Uploads / Image Generations / Video Generations / Liked. Two render modes:
 * pass `onPick` to use this as a composer picker (plain thumbnails, clicking
 * one attaches it and closes); omit it to browse standalone from Pilot's
 * header (the real interactive GenerationGrid — favorite/delete/open all
 * work). Kept as two render paths instead of forcing GenerationCard into a
 * "pick" mode, since its click behavior is a fixed contract shared with
 * Gallery/Home/Projects.
 */
export function AssetsModal({ onPick, onClose }: { onPick?: (url: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState<AssetsTab>("uploads");

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        className="flex h-[80vh] max-h-[680px] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border-subtle p-3">
          <span className="text-sm font-semibold">Assets</span>
          <button onClick={onClose} title="Close" className="icon-btn-round ml-auto shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 border-b border-border-subtle p-2 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                tab === t.id ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
              )}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {tab === "uploads" ? (
            <UploadsGrid onPick={onPick} />
          ) : onPick ? (
            <GenerationPickGrid tab={tab} onPick={onPick} />
          ) : (
            <GenerationBrowseGrid tab={tab} />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
