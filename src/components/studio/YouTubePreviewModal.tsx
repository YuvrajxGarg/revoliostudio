"use client";

import { useState } from "react";
import { X } from "lucide-react";

/**
 * Mocked-up "how does this read in a real feed" preview for a generated
 * thumbnail — purely cosmetic placeholders (views/time/duration/channel)
 * since the point is judging the thumbnail + title combo at realistic
 * scale, not real video metadata.
 */
export function YouTubePreviewModal({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const displayTitle = title.trim() || "Your video title goes here";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between pb-1">
          <div>
            <h2 className="text-sm font-semibold">YouTube preview</h2>
            <p className="mt-0.5 text-xs text-muted">See how this thumbnail reads in the feed next to a title.</p>
          </div>
          <button onClick={onClose} className="shrink-0 text-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3">
          <div className="panel-label mb-1.5">Video title</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter your title to see how it looks together"
            className="w-full rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-sm outline-none placeholder:text-muted focus:border-accent"
          />
        </div>

        <div className="mt-4">
          <div className="panel-label mb-1.5">Desktop feed</div>
          <div className="w-full max-w-[280px]">
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
              <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-medium text-white">
                12:25
              </span>
            </div>
            <div className="mt-2 flex items-start gap-2">
              <span className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-accent" />
              <div className="min-w-0">
                <div className="text-xs font-medium leading-snug line-clamp-2">{displayTitle}</div>
                <div className="mt-0.5 text-[11px] text-muted">Your Channel</div>
                <div className="text-[11px] text-muted">128K views · 2 hours ago</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="panel-label mb-1.5">Search result</div>
          <div className="flex items-start gap-2">
            <div className="relative h-[68px] w-[120px] shrink-0 overflow-hidden rounded-lg bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
              <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[9px] font-medium text-white">
                12:25
              </span>
            </div>
            <div className="min-w-0 pt-0.5">
              <div className="text-xs font-medium leading-snug line-clamp-2">{displayTitle}</div>
              <div className="mt-0.5 text-[11px] text-muted">Your Channel · 128K views</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
