"use client";

import { AlertTriangle, Loader2, MoreHorizontal } from "lucide-react";
import type { Generation } from "@/lib/types";
import { cn, formatRelativeTime } from "@/lib/utils";
import { VideoThumb } from "./VideoThumb";

function studioName(generation: Generation): string {
  if (generation.seq_number) {
    return `revoliostudio_${String(generation.seq_number).padStart(3, "0")}`;
  }
  return `revoliostudio-${generation.id.slice(0, 8)}`;
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border-subtle bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">
      {children}
    </span>
  );
}

/**
 * Compact right-rail history list for the Video studio — thumbnail, prompt,
 * model, and settings tags per row, matching the Reference's "big center
 * preview + slim history list" layout instead of a plain thumbnail grid.
 */
export function VideoHistoryRail({
  items,
  selectedId,
  onSelect,
  onOpenDetail,
  hasMore,
  onLoadMore,
  emptyLabel,
}: {
  items: Generation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenDetail: (id: string) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-10 text-center text-xs text-muted">
        {emptyLabel || "Nothing here yet."}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto divide-y divide-border-subtle/50">
      {items.map((g) => {
        const media = g.output_urls[0];
        const settings = (g.settings ?? {}) as Record<string, unknown>;
        const active = g.id === selectedId;
        return (
          <button
            key={g.id}
            onClick={() => onSelect(g.id)}
            className={cn(
              "group relative flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors",
              active ? "bg-surface-2" : "hover:bg-surface-2/60"
            )}
          >
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-surface">
              {g.status === "completed" && media ? (
                // thumbnail_url falls back to the raw .mp4 output for video
                // rows (no separate poster image exists), so an <img> tag
                // just shows a broken-image icon — render it as a muted
                // <video> instead, same as the grid card does.
                <VideoThumb src={media} className="h-full w-full object-cover" />
              ) : g.status === "failed" ? (
                <div className="flex h-full w-full items-center justify-center bg-black/40">
                  <AlertTriangle className="h-3.5 w-3.5 text-danger-text" />
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center shimmer">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-accent truncate">{g.model_label}</div>
              <p className="mt-0.5 text-xs text-foreground/80 line-clamp-2">
                {g.prompt || studioName(g)}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {typeof settings.resolution === "string" && <Tag>{settings.resolution}</Tag>}
                {typeof settings.duration === "number" && <Tag>{settings.duration}s</Tag>}
                {typeof settings.aspectRatio === "string" && <Tag>{settings.aspectRatio}</Tag>}
              </div>
              <div className="mt-1 text-[10px] text-muted">{formatRelativeTime(g.created_at)}</div>
            </div>

            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetail(g.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onOpenDetail(g.id);
                }
              }}
              title="Open details"
              className="absolute right-2 top-2 rounded-md p-1 opacity-0 hover:bg-border-subtle group-hover:opacity-100"
            >
              <MoreHorizontal className="h-3.5 w-3.5 text-muted" />
            </span>
          </button>
        );
      })}

      {hasMore && (
        <div className="flex justify-center py-3">
          <button
            onClick={onLoadMore}
            className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
