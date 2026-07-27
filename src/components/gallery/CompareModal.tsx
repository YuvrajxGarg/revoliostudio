"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftRight, Loader2, Music2, X } from "lucide-react";
import type { Generation } from "@/lib/types";
import { useGenerations } from "@/hooks/useGenerations";
import { cn } from "@/lib/utils";

/**
 * A/B compare — opened from a generation's detail panel. Shows the current
 * generation on the left and lets the user pick any other completed
 * generation (same category) to view side-by-side at matched height, so two
 * results can be judged against each other directly instead of flipping
 * between them. Pure client-side over data already loaded — no new tables or
 * endpoints.
 */
function Media({ gen }: { gen: Generation }) {
  const url = gen.output_urls?.[0];
  if (!url) return <div className="flex h-full w-full items-center justify-center text-xs text-muted">No media</div>;
  if (gen.category === "video") {
    // eslint-disable-next-line jsx-a11y/media-has-caption
    return <video src={url} controls loop muted className="max-h-[68vh] max-w-full object-contain" />;
  }
  if (gen.category === "audio") {
    return (
      <div className="flex flex-col items-center gap-3 p-6">
        <Music2 className="h-8 w-8 text-muted" />
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio src={url} controls className="w-64" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={gen.prompt} className="max-h-[68vh] max-w-full object-contain" />;
}

function Pane({ gen, onSwap }: { gen: Generation; onSwap?: () => void }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-black/40 p-2">
        <Media gen={gen} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 px-1">
        <span className="truncate text-xs text-muted" title={gen.prompt}>
          {gen.model_label}
        </span>
        {onSwap && (
          <button
            onClick={onSwap}
            className="shrink-0 rounded-md border border-border-subtle bg-surface-2 px-2 py-1 text-[11px] hover:bg-border-subtle"
          >
            Change
          </button>
        )}
      </div>
    </div>
  );
}

export function CompareModal({ generation, onClose }: { generation: Generation; onClose: () => void }) {
  const [other, setOther] = useState<Generation | null>(null);
  const { items, loading, hasMore, loadMore } = useGenerations(generation.category);
  const candidates = items.filter((g) => g.id !== generation.id && g.status === "completed" && g.output_urls?.[0]);

  // Esc closes, matching the other full-screen overlays.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    // Centered dialog (not full-screen). stopPropagation is essential: this
    // modal is often rendered inside the detail panel, which is portaled to
    // <body> too — React events bubble through the *component* tree across
    // portals, so without it a click on a candidate would bubble up to the
    // detail panel's backdrop onClick and close everything (which read as
    // "picking a generation just closes the modal").
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-2xl border border-border-subtle bg-surface p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ArrowLeftRight className="h-4 w-4" /> Compare
          </div>
          <button onClick={onClose} className="icon-btn-round" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 gap-3">
          <Pane gen={generation} />
          {other ? (
            <Pane gen={other} onSwap={() => setOther(null)} />
          ) : (
            <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-border-subtle bg-surface-2/40 p-3">
              <p className="mb-2 px-1 text-xs text-muted">Pick a generation to compare against</p>
              <div className="min-h-0 flex-1 overflow-y-auto">
              {candidates.length === 0 && loading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted" />
                </div>
              ) : candidates.length === 0 ? (
                <p className="px-1 py-8 text-center text-xs text-muted">Nothing else to compare yet.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {candidates.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setOther(g)}
                      className={cn(
                        "group relative aspect-square overflow-hidden rounded-lg border border-border-subtle hover:border-accent"
                      )}
                      title={g.prompt}
                    >
                      {g.category === "video" ? (
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        <video src={g.output_urls[0]} muted className="h-full w-full object-cover" />
                      ) : g.category === "audio" ? (
                        <div className="flex h-full w-full items-center justify-center bg-surface-2">
                          <Music2 className="h-5 w-5 text-muted" />
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={g.output_urls[0]} alt={g.prompt} className="h-full w-full object-cover" />
                      )}
                    </button>
                  ))}
                </div>
              )}
                {hasMore && candidates.length > 0 && (
                  <div className="flex justify-center py-3">
                    <button
                      onClick={loadMore}
                      className="rounded-lg border border-border-subtle bg-surface-2 px-3 py-1.5 text-xs hover:bg-border-subtle"
                    >
                      Load more
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
