"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Script from "next/script";
import {
  X,
  Download,
  Layers,
  Loader2,
  Copy,
  Check,
  Sparkles,
  Scissors,
  Video,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Music2,
  Trash2,
  Share2,
  ArrowLeftRight,
  Maximize2,
  Globe,
  Link2,
  Info,
  Wand2,
  MessageCircle,
  Brush,
} from "lucide-react";
import type { Generation } from "@/lib/types";
import { useComposerStore, type ComposerSettings } from "@/store/composerStore";
import { downloadImageAsPng, downloadFile, cn } from "@/lib/utils";
import { deleteGeneration } from "@/lib/deleteGeneration";
import { formatCostUSD, formatCostINR } from "@/lib/pricing";
import { formatErrorMessage } from "@/lib/errorFormat";
import { UpscaleModal } from "./UpscaleModal";
import { ShareModal } from "./ShareModal";
import { CompareModal } from "./CompareModal";
import { ExpandModal } from "./ExpandModal";
import { InpaintModal } from "./InpaintModal";
import { GenerationComments } from "./GenerationComments";
import { VideoPlayer } from "./VideoPlayer";
import { ImageLightbox } from "@/components/ui/ImageLightbox";

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

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Renders a stored prompt with "@mention" tokens visually highlighted, same
 * accent-pill treatment as the live composer's MentionHighlightTextarea —
 * this is the read-only equivalent for a saved generation. Reference names
 * aren't persisted (only URLs), so known labels are reconstructed from the
 * "Image N" auto-naming convention used when a reference is attached; any
 * other "@token" (a custom-renamed single-word ref, etc.) still highlights
 * via a generic fallback, just without special-casing its exact text.
 */
function PromptWithMentions({ prompt, referenceCount }: { prompt: string; referenceCount: number }) {
  const knownLabels = Array.from({ length: referenceCount }, (_, i) => `Image ${i + 1}`).sort(
    (a, b) => b.length - a.length
  );
  const pattern = knownLabels.length
    ? new RegExp(`@(?:${knownLabels.map(escapeRegExp).join("|")}|[\\w-]+)(?!\\w)`, "gi")
    : /@[\w-]+(?!\w)/g;

  const parts: { text: string; mention: boolean }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(prompt))) {
    if (match.index > lastIndex) parts.push({ text: prompt.slice(lastIndex, match.index), mention: false });
    parts.push({ text: match[0], mention: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < prompt.length) parts.push({ text: prompt.slice(lastIndex), mention: false });
  if (parts.length === 0) parts.push({ text: prompt, mention: false });

  return (
    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">
      {parts.map((p, i) =>
        p.mention ? (
          <span key={i} className="rounded-md bg-accent/20 px-0.5 text-accent font-medium">
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </p>
  );
}

function labelForFrame(mode: string, which: "start" | "end") {
  if (mode === "motion") return which === "start" ? "Motion video" : "Character image";
  if (mode === "v2v" || (mode === "enhance" && which === "start")) return "Source video";
  return which === "start" ? "Start frame" : "End frame";
}

function isFrameVideo(mode: string, which: "start" | "end") {
  return which === "start" && (mode === "motion" || mode === "v2v" || mode === "enhance");
}

function RefThumb({
  url,
  label,
  isVideo,
  onView,
}: {
  url: string;
  label: string;
  isVideo?: boolean;
  onView: (url: string) => void;
}) {
  return (
    <button
      onClick={() => onView(url)}
      title={`${label} — click to view full size`}
      className="flex flex-col items-center gap-1 w-16 shrink-0"
    >
      <div className="h-14 w-14 rounded-lg overflow-hidden border border-border-subtle hover:border-accent/50 transition-colors">
        {isVideo ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={url} muted className="h-full w-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="h-full w-full object-cover" />
        )}
      </div>
      <span className="text-[10px] text-muted truncate max-w-full">{label}</span>
    </button>
  );
}

// Default i2v model to hand off to when "Turn to video" is used.
const TURN_TO_VIDEO_MODEL_ID = "seedance-2-i2v";

function StatusDot({ status }: { status: string }) {
  if (status === "completed") return null;
  const color = status === "failed" ? "bg-danger" : "bg-accent animate-pulse";
  return <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", color)} />;
}

export function GenerationDetailPanel({
  generation,
  onClose,
  onToolRun,
  onDeleted,
  readOnly = false,
}: {
  generation: Generation;
  onClose: () => void;
  onToolRun?: () => void;
  onDeleted?: (id: string) => void;
  /** True for generations viewed via the Gallery's "Shared" tab — the
   * current user doesn't own the row (RLS would reject a delete/share
   * attempt), so those actions are hidden rather than left to fail. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const { addReference, setModelId, setCategory, setPrompt, updateSettings, resetAfterSubmit } =
    useComposerStore();

  // Esc closes the panel, same as the X button.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [runningTool, setRunningTool] = useState<string | null>(null);
  const [toolError, setToolError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [upscaleOpen, setUpscaleOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [expandOpen, setExpandOpen] = useState(false);
  const [inpaintOpen, setInpaintOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<"info" | "tools" | "comments">("info");
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [isPublic, setIsPublic] = useState(!!generation.is_public);
  const [publishBusy, setPublishBusy] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [downloadingAll, setDownloadingAll] = useState(false);
  // Portaled straight to document.body (see the return statement below) so
  // this "fixed inset-0" overlay always positions/stacks against the real
  // viewport — without this, opening it from inside any backdrop-blur
  // container (blur/filter establishes a new containing block for fixed
  // descendants) traps and clips it to that container's box instead of
  // showing a real fullscreen lightbox. `mounted` guards the createPortal
  // call from running during SSR, where `document` doesn't exist.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Which reference thumbnail (if any) is open in the bare lightbox — kept
  // separate from the main media viewer above since references aren't full
  // Generation rows and shouldn't pull up this whole details sidebar again.
  const [viewingRef, setViewingRef] = useState<{ url: string; isVideo?: boolean } | null>(null);

  const outputs = generation.output_urls ?? [];
  // Reset back to the first output whenever we open a different generation —
  // otherwise a stale index from a previously-viewed multi-output batch
  // could point past the end of this one's outputs array.
  useEffect(() => setSelectedIndex(0), [generation.id]);
  const media = outputs[selectedIndex] ?? outputs[0];
  const isImage = generation.category === "image";
  const isVideo = generation.category === "video";
  const is3d = generation.category === "3d";
  const isAudio = generation.category === "audio";
  const isFailed = generation.status === "failed";
  const failure = isFailed ? formatErrorMessage(generation.error) : null;
  const hasMultipleOutputs = isImage && outputs.length > 1;

  async function runTool(modelId: string, label: string) {
    if (!media || runningTool) return;
    setRunningTool(label);
    setToolError(null);
    try {
      const res = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, prompt: "", references: [media], settings: {} }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `${label} failed to start`);
      }
      onToolRun?.();
      onClose();
    } catch (err) {
      setToolError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRunningTool(null);
    }
  }

  function turnToVideo() {
    if (!media) return;
    resetAfterSubmit();
    setCategory("video");
    setModelId(TURN_TO_VIDEO_MODEL_ID);
    addReference(media, studioName(generation), 9);
    onClose();
    router.push("/studio/video");
  }

  function recreate() {
    resetAfterSubmit();
    setCategory(generation.category);
    setModelId(generation.model_id);
    setPrompt(generation.prompt || "");
    updateSettings((generation.settings ?? {}) as Partial<ComposerSettings>);
    generation.reference_urls?.forEach((url, i) => addReference(url, `Image ${i + 1}`, 9));
    onClose();
    router.push(`/studio/${generation.category}`);
  }

  function useAsReference() {
    if (!media) return;
    addReference(media, studioName(generation), 9);
    onClose();
  }

  async function handleDownload() {
    if (!media || downloading) return;
    setDownloading(true);
    const base = studioName(generation);
    const suffix = hasMultipleOutputs ? `-${selectedIndex + 1}` : "";
    try {
      if (isImage) {
        await downloadImageAsPng(media, `${base}${suffix}.png`);
      } else {
        const ext = fileExt(media, isVideo ? "mp4" : isAudio ? "mp3" : "glb");
        await downloadFile(media, `${base}${suffix}.${ext}`);
      }
    } finally {
      setDownloading(false);
    }
  }

  async function handleDownloadAll() {
    if (downloadingAll || outputs.length === 0) return;
    setDownloadingAll(true);
    const base = studioName(generation);
    try {
      // Sequential rather than Promise.all — downloadImageAsPng drives the
      // browser's save dialog/blob flow, which some browsers throttle or
      // drop entirely when fired concurrently for many files at once.
      for (let i = 0; i < outputs.length; i++) {
        await downloadImageAsPng(outputs[i], `${base}-${i + 1}.png`);
      }
    } finally {
      setDownloadingAll(false);
    }
  }

  function copyPrompt() {
    if (!generation.prompt) return;
    navigator.clipboard?.writeText(generation.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteGeneration(generation.id);
    if (result.ok) {
      onDeleted?.(generation.id);
      onClose();
    } else {
      setDeleting(false);
      setDeleteError(result.error ?? "Failed to delete");
    }
  }

  // Publish / unpublish to the public Community feed (0027 migration).
  async function togglePublish() {
    if (publishBusy) return;
    const next = !isPublic;
    setPublishBusy(true);
    setIsPublic(next); // optimistic
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error } = await supabase
      .from("generations")
      .update({ is_public: next, published_at: next ? new Date().toISOString() : null })
      .eq("id", generation.id);
    if (error) setIsPublic(!next); // revert on failure
    setPublishBusy(false);
  }

  // Create (or reuse) a public 24h token link (media copied to our storage,
  // see /api/share-link) and copy it to the clipboard. Surfaces any failure
  // (e.g. the 0027/0028 migrations not applied yet, or a missing service-role
  // key) instead of silently doing nothing.
  async function copyPublicLink() {
    if (linkBusy) return;
    setLinkBusy(true);
    setLinkError(null);
    try {
      const res = await fetch("/api/share-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId: generation.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) {
        throw new Error(data.error || "Couldn't create a share link. Make sure the latest DB migrations are applied.");
      }
      const url = `${window.location.origin}/s/${encodeURIComponent(data.token)}`;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // Clipboard blocked (insecure context / permissions) — fall back to a
        // prompt so the user can still copy the link manually.
        window.prompt("Copy this share link:", url);
      }
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3500);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLinkBusy(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/90 flex" onClick={onClose}>
      <div
        className="flex-1 flex flex-col items-center justify-center gap-3 p-6 min-w-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 min-h-0 flex items-center justify-center w-full">
        {isVideo && media ? (
          <VideoPlayer src={media} autoPlay className="w-full h-full max-w-full max-h-full rounded-xl overflow-hidden" />
        ) : is3d && media ? (
          <>
            {/* Loaded here (not globally in app/layout.tsx) so every page
                doesn't pay for downloading/parsing model-viewer's
                Three.js-backed bundle on every navigation — only the rare
                case of actually opening a 3D generation's detail view does.
                next/script dedupes by `src`, so re-mounting this on a second
                3D item is a no-op, not a second download. */}
            <Script
              type="module"
              src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"
              strategy="afterInteractive"
            />
            {/* @ts-expect-error -- model-viewer is a web component loaded via CDN script */}
            <model-viewer
              src={media}
              camera-controls
              auto-rotate
              style={{ width: "70vw", height: "80vh", background: "var(--surface)", borderRadius: "0.75rem" }}
            />
          </>
        ) : isAudio && media ? (
          <div className="flex flex-col items-center gap-4 rounded-xl bg-surface p-10">
            <Music2 className="h-10 w-10 text-muted" />
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio src={media} controls autoPlay className="w-80 max-w-full" />
          </div>
        ) : media ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media} alt={generation.prompt} className="max-w-full max-h-full object-contain rounded-xl" />
        ) : (
          <div className="flex flex-col items-center gap-3 text-center max-w-md px-4">
            <AlertTriangle className="h-8 w-8 text-danger-text" />
            <p className="text-sm text-white/70">{failure?.message ?? "This generation failed and has no output."}</p>
            {failure?.details && (
              <details className="w-full text-left">
                <summary className="cursor-pointer text-xs text-white/40 hover:text-white/60">
                  Technical details
                </summary>
                <p className="mt-1.5 text-[11px] text-white/40 whitespace-pre-wrap break-words">{failure.details}</p>
              </details>
            )}
          </div>
        )}
        </div>

        {hasMultipleOutputs && (
          <div className="flex items-center gap-2 shrink-0 max-w-full overflow-x-auto px-1 pb-1">
            {outputs.map((url, i) => (
              <button
                key={url + i}
                onClick={() => setSelectedIndex(i)}
                className={cn(
                  "h-14 w-14 shrink-0 rounded-lg overflow-hidden border-2 transition-colors",
                  i === selectedIndex ? "border-accent" : "border-transparent opacity-60 hover:opacity-100"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Output ${i + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className="w-[360px] shrink-0 h-full bg-surface border-l border-border-subtle flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold font-mono truncate">{studioName(generation)}</span>
              <StatusDot status={generation.status} />
            </div>
            <div className="text-xs text-muted mt-0.5 capitalize">
              {generation.model_label}
              {generation.status !== "completed" && (
                <span className="text-muted/70"> · {generation.status}</span>
              )}
            </div>
            {generation.shared_by && (
              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted">
                <Share2 className="h-3 w-3 shrink-0" />
                Shared by {generation.shared_by.display_name || generation.shared_by.email}
              </div>
            )}
            {/* Calculated total cost for this specific job (rate × the duration
                actually used) — surfaced right away instead of buried behind
                the collapsed Details accordion below. */}
            {generation.cost_usd != null && (
              <div className="text-xs font-medium text-foreground/80 mt-1">
                {formatCostUSD(Number(generation.cost_usd))} · {formatCostINR(Number(generation.cost_usd))}
                {typeof generation.settings?.duration === "number" && (
                  <span className="text-muted font-normal"> · {generation.settings.duration as number}s</span>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} className="icon-btn-round shrink-0" title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Info / Tools / Comments tabs */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-border-subtle shrink-0">
          {([
            { id: "info", label: "Info", icon: Info },
            { id: "tools", label: "Tools", icon: Wand2 },
            { id: "comments", label: "Comments", icon: MessageCircle },
          ] as const).map((t) => {
            const TabIcon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setPanelTab(t.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                  panelTab === t.id ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
                )}
              >
                <TabIcon className="h-3.5 w-3.5" /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
        {panelTab === "info" && (
        <>
        {generation.prompt && (
          <div className="mx-4 mt-4 rounded-xl border border-border-subtle bg-surface-2 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Prompt</span>
              <button
                onClick={copyPrompt}
                className="flex items-center gap-1 text-[11px] text-muted hover:text-foreground transition-colors"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className={cn("relative", !promptExpanded && "max-h-32 overflow-hidden")}>
              <PromptWithMentions prompt={generation.prompt} referenceCount={generation.reference_urls?.length ?? 0} />
              {!promptExpanded && generation.prompt.length > 240 && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-surface-2 to-transparent" />
              )}
            </div>
            {generation.prompt.length > 240 && (
              <button
                onClick={() => setPromptExpanded((v) => !v)}
                className="mt-1.5 flex items-center gap-1 text-[11px] text-muted hover:text-foreground transition-colors"
              >
                {promptExpanded ? "Show less" : "See all"}
                <ChevronDown className={cn("h-3 w-3 transition-transform", promptExpanded && "rotate-180")} />
              </button>
            )}
          </div>
        )}

        {(generation.reference_urls?.length > 0 || generation.start_frame_url || generation.end_frame_url) && (
          <div className="mx-4 mt-3 rounded-xl border border-border-subtle bg-surface-2 p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">References used</div>
            <div className="flex flex-wrap gap-2">
              {generation.reference_urls?.map((url, i) => (
                <RefThumb
                  key={url + i}
                  url={url}
                  label={`Image ${i + 1}`}
                  onView={(u) => setViewingRef({ url: u })}
                />
              ))}
              {generation.start_frame_url && (
                <RefThumb
                  url={generation.start_frame_url}
                  label={labelForFrame(generation.mode, "start")}
                  isVideo={isFrameVideo(generation.mode, "start")}
                  onView={(u) => setViewingRef({ url: u, isVideo: isFrameVideo(generation.mode, "start") })}
                />
              )}
              {generation.end_frame_url && (
                <RefThumb
                  url={generation.end_frame_url}
                  label={labelForFrame(generation.mode, "end")}
                  isVideo={isFrameVideo(generation.mode, "end")}
                  onView={(u) => setViewingRef({ url: u, isVideo: isFrameVideo(generation.mode, "end") })}
                />
              )}
            </div>
          </div>
        )}

        {isFailed && failure && (
          <div className="mx-4 mt-3 rounded-xl border border-danger/30 bg-danger/10 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-danger-text shrink-0" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-danger-text">Failed</span>
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">{failure.message}</p>
            {failure.details && (
              <details className="mt-1.5">
                <summary className="cursor-pointer text-[11px] text-muted hover:text-foreground">
                  Technical details
                </summary>
                <p className="mt-1 text-[11px] text-muted whitespace-pre-wrap break-words">{failure.details}</p>
              </details>
            )}
          </div>
        )}

        <div className="mx-4 mt-3 rounded-xl border border-border-subtle overflow-hidden">
          <button
            onClick={() => setDetailsOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted hover:bg-surface-2 transition-colors"
          >
            Details
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", detailsOpen && "rotate-180")} />
          </button>
          {detailsOpen && (
            <div className="px-3 pb-3 pt-2.5 border-t border-border-subtle flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">Model</span>
                <span>{generation.model_label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Category</span>
                <span className="capitalize">{generation.category}</span>
              </div>
              {generation.cost_usd != null && (
                <div className="flex justify-between">
                  <span className="text-muted">Cost</span>
                  <span>
                    {formatCostUSD(Number(generation.cost_usd))} · {formatCostINR(Number(generation.cost_usd))}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted">Status</span>
                <span className="capitalize">{generation.status}</span>
              </div>
            </div>
          )}
        </div>

        </>
        )}

        {panelTab === "tools" && (
        <>
        {(isImage || isVideo) && media ? (
          <div className="mx-4 mt-3">
            <div className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Edit image</div>
            <div className="rounded-xl border border-border-subtle overflow-hidden divide-y divide-border-subtle">
              <ToolRow
                icon={<Sparkles className="h-4 w-4" />}
                label="Upscale"
                onClick={() => setUpscaleOpen(true)}
              />
              <ToolRow
                icon={<ArrowLeftRight className="h-4 w-4" />}
                label="Compare"
                onClick={() => setCompareOpen(true)}
              />
              {isImage && (
                <ToolRow
                  icon={<Brush className="h-4 w-4" />}
                  label="Inpaint"
                  onClick={() => setInpaintOpen(true)}
                />
              )}
              {isImage && (
                <ToolRow
                  icon={<Maximize2 className="h-4 w-4" />}
                  label="Generative Expand"
                  onClick={() => setExpandOpen(true)}
                />
              )}
              {isImage && (
                <ToolRow
                  icon={<Scissors className="h-4 w-4" />}
                  label="Remove Background"
                  busy={runningTool === "Remove Background"}
                  disabled={!!runningTool}
                  onClick={() => runTool("ai-background-remover", "Remove Background")}
                />
              )}
              {isImage && (
                <ToolRow icon={<Video className="h-4 w-4" />} label="Turn to Video" onClick={turnToVideo} />
              )}
            </div>
            {toolError && <div className="mt-2 text-xs text-danger-text">{formatErrorMessage(toolError).message}</div>}
          </div>
        ) : (
          <p className="px-5 py-8 text-center text-xs text-muted">No editing tools for this type yet.</p>
        )}
        </>
        )}

        {panelTab === "info" && (
        <>
        {/* Publish to Community + copy a public link — owner only. */}
        {media && !readOnly && (
          <div className="mx-4 mt-3 flex items-center gap-2">
            <button
              onClick={togglePublish}
              disabled={publishBusy}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 h-10 rounded-xl border text-sm font-medium transition-colors disabled:opacity-50",
                isPublic
                  ? "border-accent/50 bg-accent/10 text-foreground"
                  : "border-border-subtle bg-surface-2 hover:bg-border-subtle"
              )}
              title={isPublic ? "Published to the Community feed — click to unpublish" : "Publish to the Community feed"}
            >
              {publishBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              {isPublic ? "Published" : "Publish"}
            </button>
            <button
              onClick={copyPublicLink}
              disabled={linkBusy}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-surface-2 hover:bg-border-subtle transition-colors disabled:opacity-50"
              title="Copy a public share link (expires in 24 hours)"
            >
              {linkBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : linkCopied ? (
                <Check className="h-4 w-4 text-accent" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
            </button>
          </div>
        )}
        {linkCopied && (
          <div className="mx-4 mt-1.5 text-[11px] text-accent">
            Public link copied — this link will expire in 24 hours.
          </div>
        )}
        {linkError && <div className="mx-4 mt-1.5 text-[11px] text-danger-text">{linkError}</div>}
        </>
        )}

        {panelTab === "comments" &&
          (media ? (
            <GenerationComments generationId={generation.id} />
          ) : (
            <p className="px-5 py-8 text-center text-xs text-muted">Comments appear once this generation finishes.</p>
          ))}
        </div>

        {panelTab === "info" && (
        <div className="p-4 border-t border-border-subtle shrink-0 flex flex-col gap-2.5">
          <button
            onClick={recreate}
            className="flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-accent text-sm font-bold text-white hover:brightness-95 transition-[filter]"
          >
            <RotateCcw className="h-4 w-4" /> Recreate
          </button>

          {media && (
            <div className="flex items-center gap-2">
              {isImage && (
                <button
                  onClick={useAsReference}
                  className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl border border-border-subtle bg-surface-2 text-sm font-medium hover:bg-border-subtle transition-colors"
                >
                  <Layers className="h-4 w-4" /> Reference
                </button>
              )}
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl border border-border-subtle bg-surface-2 text-sm font-medium hover:bg-border-subtle transition-colors disabled:opacity-50"
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {hasMultipleOutputs ? `Download #${selectedIndex + 1}` : "Download"}
              </button>
              {!readOnly && (
                <button
                  onClick={() => setShareOpen(true)}
                  title="Share"
                  className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl border border-border-subtle bg-surface-2 text-sm font-medium hover:bg-border-subtle transition-colors"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              )}
              {!readOnly && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  title="Delete"
                  className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl border border-danger/30 bg-danger/10 text-danger-text hover:bg-danger/20 transition-colors disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              )}
            </div>
          )}

          {hasMultipleOutputs && (
            <button
              onClick={handleDownloadAll}
              disabled={downloadingAll}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border-subtle bg-surface-2 text-sm font-medium hover:bg-border-subtle transition-colors disabled:opacity-50"
            >
              {downloadingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download all {outputs.length}
            </button>
          )}

          {!media && !readOnly && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-danger/30 bg-danger/10 text-danger-text text-sm font-medium hover:bg-danger/20 transition-colors disabled:opacity-50"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </button>
          )}

          {deleteError && (
            <div className="rounded-lg bg-danger/10 border border-danger/30 px-3 py-2 text-xs text-danger-text">
              {deleteError}
            </div>
          )}
        </div>
        )}
      </div>

      {upscaleOpen && (
        <UpscaleModal
          generation={generation}
          onClose={() => setUpscaleOpen(false)}
          onSubmitted={() => {
            setUpscaleOpen(false);
            onToolRun?.();
            onClose();
          }}
        />
      )}

      {shareOpen && <ShareModal generation={generation} onClose={() => setShareOpen(false)} />}

      {compareOpen && <CompareModal generation={generation} onClose={() => setCompareOpen(false)} />}

      {expandOpen && media && (
        <ExpandModal
          imageUrl={media}
          projectId={generation.project_id ?? null}
          onClose={() => setExpandOpen(false)}
          onSubmitted={() => {
            setExpandOpen(false);
            onToolRun?.();
            onClose();
          }}
        />
      )}

      {inpaintOpen && media && (
        <InpaintModal
          imageUrl={media}
          projectId={generation.project_id ?? null}
          onClose={() => setInpaintOpen(false)}
          onSubmitted={() => {
            setInpaintOpen(false);
            onToolRun?.();
            onClose();
          }}
        />
      )}

      {viewingRef && (
        <ImageLightbox
          url={viewingRef.url}
          mediaType={viewingRef.isVideo ? "video" : "image"}
          onClose={() => setViewingRef(null)}
        />
      )}
    </div>,
    document.body
  );
}

function ToolRow({
  icon,
  label,
  onClick,
  busy,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface-2 transition-colors disabled:opacity-50"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      </span>
      <span className="flex-1 text-left">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted shrink-0" />
    </button>
  );
}
