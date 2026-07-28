"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AtSign, Image as ImageIcon, Loader2, Upload, X } from "lucide-react";
import { uploadReferenceFile } from "@/lib/upload";
import { useGenerations } from "@/hooks/useGenerations";
import { cn } from "@/lib/utils";
import { formatErrorMessage } from "@/lib/errorFormat";
import { ImageLightbox } from "@/components/ui/ImageLightbox";

export interface AutopilotReference {
  id: string;
  url: string;
  /** Optional short label for what this image actually shows (e.g. "main character, blue jacket"). User-typed here take priority; when left blank, Pilot auto-captions the image before planning instead — see tagUntaggedReferences in lib/orchestrator.ts. Either way, this is what lets the planner reliably use more than one attached image, since it can only visually see the first one itself. */
  tag?: string;
}

/**
 * The "@" attach button next to Autopilot's brief input — pick an existing
 * generation from your Library or upload something new, either becomes a
 * numbered "Image N" the planner can see and point specific steps at (see
 * usesReferenceLabels in orchestrator.ts). Chips render just above the
 * textarea rather than true inline @-tokens in the text — same visual
 * result Higgsfield's screenshot shows, without needing caret-position
 * tracking in a plain textarea. Each chip has a small label field under it —
 * optional, but worth filling in when more than one image is attached (e.g.
 * "main character" / "background") so the planner knows what it's looking
 * at without having to guess from a bare URL.
 */
export function AutopilotReferencePicker({
  references,
  onAdd,
  onRemove,
  onTagChange,
  onBrowseAll,
  max = 4,
}: {
  references: AutopilotReference[];
  onAdd: (url: string) => void;
  onRemove: (id: string) => void;
  onTagChange: (id: string, tag: string) => void;
  /** Opens the full Assets modal (Uploads/Image/Video/Liked) in pick mode — the last-16 grid below is just a quick shortlist. */
  onBrowseAll?: () => void;
  max?: number;
}) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pos, setPos] = useState<{ bottom: number; left: number }>({ bottom: 0, left: 0 });
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Most recent generations across every tool — a lightweight "from your
  // Library" picker source, not a full search (see useGenerations' own
  // default page size).
  const { items } = useGenerations();

  // Portaled to document.body (see the panel below) rather than positioned
  // with a plain `absolute`/`fixed` inside this component's own DOM spot —
  // this composer sits inside a backdrop-blur pane (same trap as
  // GenerationDetailPanel's lightbox: a blur/filter ancestor becomes the
  // containing block for `fixed` descendants), which would otherwise clip
  // the panel and shrink the click-away backdrop down to that pane's bounds
  // instead of the full viewport. Same pattern LlmModelSelector already uses.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function toggleOpen() {
    if (!open) {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setPos({ bottom: window.innerHeight - rect.top + 8, left: rect.left });
    }
    setOpen((v) => !v);
  }

  async function handleUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const { url } = await uploadReferenceFile(file);
      onAdd(url);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploading(false);
    }
  }

  const atLimit = references.length >= max;

  return (
    <div className="flex flex-col gap-1.5">
      {references.length > 0 && (
        <div className="flex flex-wrap items-start gap-2">
          {references.map((ref, i) => (
            <div key={ref.id} className="flex flex-col items-center gap-1 w-14">
              {/* Remove button lives outside the overflow-hidden image box (as a
                  sibling under this outer `relative group`) — inside it, the
                  same overflow-hidden that rounds the image would also clip
                  off the part of the button poking past the corner. */}
              <div className="relative h-12 w-12 shrink-0 group">
                <div className="h-full w-full rounded-lg overflow-hidden border border-border-subtle">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ref.url}
                    alt={`Image ${i + 1}`}
                    title="Click to view full size"
                    onClick={() => setViewingUrl(ref.url)}
                    className="h-full w-full object-cover cursor-pointer hover:brightness-90 transition-[filter]"
                  />
                </div>
                <span className="absolute top-0 left-0 bg-black/60 text-white text-[8px] leading-none px-1 py-0.5 rounded-br-md pointer-events-none">
                  {i + 1}
                </span>
                <button
                  onClick={() => onRemove(ref.id)}
                  title="Remove"
                  className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-border-subtle bg-surface text-foreground shadow-md opacity-0 group-hover:opacity-100 hover:bg-danger/10 hover:text-danger-text hover:border-danger/40 transition-all"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
              <input
                value={ref.tag ?? ""}
                onChange={(e) => onTagChange(ref.id, e.target.value)}
                placeholder={`Image ${i + 1}`}
                title="Optional — what's actually in this image (e.g. 'main character'). Helps Pilot use it correctly when more than one image is attached, since it only sees the first one directly. Left blank, Pilot captions it automatically."
                className="w-full rounded-md border border-border-subtle bg-surface px-1 py-0.5 text-[9px] text-center outline-none focus:border-accent/50 placeholder:text-muted"
              />
            </div>
          ))}
        </div>
      )}

      <div className="relative" ref={triggerRef}>
        <button
          onClick={toggleOpen}
          disabled={atLimit}
          title={atLimit ? `Up to ${max} reference images` : "Attach a reference image"}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full border border-border-subtle text-muted hover:text-foreground hover:border-foreground/40 transition-colors disabled:opacity-40",
            open && "bg-surface-2 text-foreground"
          )}
        >
          <AtSign className="h-3.5 w-3.5" />
        </button>

        {open &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={panelRef}
              style={{ position: "fixed", bottom: pos.bottom, left: pos.left }}
              className="z-[70] w-72 rounded-xl border border-border-subtle bg-surface shadow-2xl p-2.5 flex flex-col gap-2"
            >
              <button
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 rounded-lg border border-dashed border-border-subtle px-2.5 py-2 text-xs text-muted hover:text-foreground hover:border-foreground/40 transition-colors disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Upload a new image
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
              />

              <div className="flex items-center justify-between px-0.5">
                <span className="text-[10px] uppercase tracking-wide text-muted">From your Library</span>
                {onBrowseAll && (
                  <button
                    onClick={() => {
                      setOpen(false);
                      onBrowseAll();
                    }}
                    className="text-[10px] text-accent hover:underline"
                  >
                    Browse all
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
                {items
                  .filter((g) => g.category === "image" && g.status === "completed" && g.thumbnail_url)
                  .slice(0, 16)
                  .map((g) => (
                    <button
                      key={g.id}
                      onClick={() => {
                        onAdd(g.thumbnail_url!);
                        setOpen(false);
                      }}
                      title={g.prompt}
                      className="h-14 w-full rounded-md overflow-hidden border border-border-subtle hover:border-accent/50 transition-colors"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={g.thumbnail_url!} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                {items.filter((g) => g.category === "image" && g.status === "completed").length === 0 && (
                  <div className="col-span-4 flex flex-col items-center gap-1 py-4 text-muted">
                    <ImageIcon className="h-4 w-4" />
                    <span className="text-[10px]">Nothing here yet</span>
                  </div>
                )}
              </div>
              {error && <div className="text-[10px] text-danger-text px-0.5">{formatErrorMessage(error).message}</div>}
            </div>,
            document.body
          )}
      </div>
      {viewingUrl && <ImageLightbox url={viewingUrl} onClose={() => setViewingUrl(null)} />}
    </div>
  );
}
