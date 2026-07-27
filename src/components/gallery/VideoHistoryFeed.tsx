"use client";

import { AlertTriangle, Download, Loader2 } from "lucide-react";
import type { Generation } from "@/lib/types";
import { GenerationDetailPanel } from "./GenerationDetailPanel";
import { VideoThumb } from "./VideoThumb";
import { useState } from "react";
import type { ReactNode } from "react";
import { downloadFile, formatRelativeTime } from "@/lib/utils";
import { formatErrorMessage } from "@/lib/errorFormat";

function studioName(generation: Generation): string {
  if (generation.seq_number) {
    return `revoliostudio_${String(generation.seq_number).padStart(3, "0")}`;
  }
  return `revoliostudio-${generation.id.slice(0, 8)}`;
}

function fileExt(url: string, fallback: string) {
  const match = url.split("?")[0].match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1] : fallback;
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border-subtle bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
      {children}
    </span>
  );
}

function FeedRow({
  generation,
  onToolRun,
  onDeleted,
}: {
  generation: Generation;
  onToolRun?: () => void;
  onDeleted?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const media = generation.output_urls[0];
  const settings = (generation.settings ?? {}) as Record<string, unknown>;
  const openable = generation.status === "completed" || generation.status === "failed";

  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    if (!media || downloading) return;
    setDownloading(true);
    try {
      const ext = fileExt(media, "mp4");
      await downloadFile(media, `${studioName(generation)}.${ext}`);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <div className="flex gap-4 py-5 border-b border-border-subtle last:border-0">
        <button
          onClick={() => openable && setOpen(true)}
          disabled={!openable}
          className="group relative w-64 shrink-0 aspect-video rounded-xl overflow-hidden border border-border-subtle bg-surface disabled:cursor-default"
        >
          {generation.status === "completed" && media ? (
            <>
              <VideoThumb src={media} className="w-full h-full object-cover" controlSize="md" />
              {/* Hover-to-download — avoids having to open the detail panel
                  just to grab the file. Sits above VideoThumb's own hover
                  play/pause control, in the opposite corner. */}
              <span
                role="button"
                tabIndex={0}
                title="Download"
                onClick={handleDownload}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") handleDownload(e as unknown as React.MouseEvent);
                }}
                className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-md bg-black/60 opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
              >
                {downloading ? (
                  <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 text-white" />
                )}
              </span>
            </>
          ) : generation.status === "failed" ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-black/40 px-2 text-center">
              <AlertTriangle className="h-4 w-4 text-danger-text" />
              <span className="text-[10px] text-danger-text/90 line-clamp-2" title={formatErrorMessage(generation.error).details}>
                {formatErrorMessage(generation.error).message}
              </span>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center shimmer">
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            </div>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-accent">
            <span>{generation.model_label}</span>
          </div>
          <p className="mt-1 text-sm text-foreground/90 line-clamp-3">{generation.prompt || studioName(generation)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {typeof settings.resolution === "string" && <Tag>{settings.resolution}</Tag>}
            {typeof settings.duration === "number" && <Tag>{settings.duration}s</Tag>}
            {typeof settings.aspectRatio === "string" && <Tag>{settings.aspectRatio}</Tag>}
          </div>
          <div className="mt-3 text-[11px] text-muted">{formatRelativeTime(generation.created_at)}</div>
        </div>
      </div>

      {open && (
        <GenerationDetailPanel
          generation={generation}
          onClose={() => setOpen(false)}
          onToolRun={onToolRun}
          onDeleted={onDeleted}
        />
      )}
    </>
  );
}

export function VideoHistoryFeed({
  items,
  hasMore,
  onLoadMore,
  onToolRun,
  onDeleted,
  emptyLabel,
  emptyAction,
}: {
  items: Generation[];
  hasMore?: boolean;
  onLoadMore?: () => void;
  onToolRun?: () => void;
  onDeleted?: (id: string) => void;
  emptyLabel?: string;
  /** Optional quick-start control rendered under the empty-state text. */
  emptyAction?: ReactNode;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-muted">
        <p className="text-sm">{emptyLabel || "Nothing here yet."}</p>
        {emptyAction}
      </div>
    );
  }

  return (
    <div>
      {items.map((g) => (
        <FeedRow key={g.id} generation={g} onToolRun={onToolRun} onDeleted={onDeleted} />
      ))}
      {hasMore && onLoadMore && (
        <div className="flex justify-center py-6">
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
