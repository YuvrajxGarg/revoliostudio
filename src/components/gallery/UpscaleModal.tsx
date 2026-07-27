"use client";

import { useState } from "react";
import { Loader2, Info, X } from "lucide-react";
import { getModel } from "@/lib/models";
import type { Generation } from "@/lib/types";
import { Dropdown } from "@/components/ui/Dropdown";
import { Toggle } from "@/components/ui/Toggle";
import { formatCostUSD, estimateCostUSD } from "@/lib/pricing";
import { formatErrorMessage } from "@/lib/errorFormat";
import { uploadReferenceFile } from "@/lib/upload";

// Real muapi upscale endpoints, one set per media category — kept explicit
// rather than filtered off `mode === "enhance"` since that mode also covers
// non-upscale tools like background removal.
const IMAGE_UPSCALE_MODEL_IDS = ["topaz-image-upscale", "ai-image-upscaler"];
const VIDEO_UPSCALE_MODEL_IDS = ["ai-video-upscaler"];
const VIDEO_RESOLUTIONS = ["720p", "1080p", "2k", "4k"];

function ModelAvatar({ label }: { label: string }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 border border-border-subtle text-[10px] font-semibold">
      {label.charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * A dedicated model + parameter picker for upscaling — opened from the
 * gallery detail panel's "Upscale" row instead of firing a fixed model
 * instantly. Mirrors the Reference's tool modal: model dropdown, media URL +
 * upload, live preview, and the model's real parameters.
 */
export function UpscaleModal({
  generation,
  onClose,
  onSubmitted,
}: {
  generation: Generation;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const isVideo = generation.category === "video";
  const modelIds = isVideo ? VIDEO_UPSCALE_MODEL_IDS : IMAGE_UPSCALE_MODEL_IDS;
  const models = modelIds.map((id) => getModel(id)).filter((m): m is NonNullable<typeof m> => !!m);

  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const model = models.find((m) => m.id === modelId) ?? models[0];

  const [mediaUrl, setMediaUrl] = useState(generation.output_urls[0] ?? "");
  const [uploading, setUploading] = useState(false);
  const [upscaleFactor, setUpscaleFactor] = useState(model?.defaultUpscaleFactor ?? 2);
  const [resolution, setResolution] = useState("720p");
  const [copyAudio, setCopyAudio] = useState(true);
  const [safetyChecker, setSafetyChecker] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estimatedCostUSD = model ? estimateCostUSD(model, {}) : 0;

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const { url } = await uploadReferenceFile(file);
      setMediaUrl(url);
    } catch (err) {
      // Used to fail silently on e.g. an oversized file — nothing was set
      // and there was no indication why. Surface the real error (like the
      // size cap) instead.
      setError(err instanceof Error ? err.message : "Failed to upload file — check your connection and try again");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!model || submitting || !mediaUrl) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        modelId: model.id,
        prompt: "",
        settings: isVideo
          ? { resolution, keepOriginalSound: copyAudio, enableSafetyChecker: safetyChecker }
          : { upscaleFactor, enableSafetyChecker: safetyChecker },
      };
      if (isVideo) {
        body.videoUrl = mediaUrl;
      } else {
        body.references = [mediaUrl];
      }
      const res = await fetch(`/api/generate/${generation.category}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upscale failed to start");
      }
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl border border-border-subtle bg-surface p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Upscale</span>
          <button onClick={onClose} className="icon-btn-round" title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">Model</div>
          {model && (
            <Dropdown
              value={model.id}
              options={models.map((m) => ({ value: m.id, label: m.label }))}
              onChange={(v) => {
                setModelId(v);
                const next = models.find((m) => m.id === v);
                setUpscaleFactor(next?.defaultUpscaleFactor ?? 2);
              }}
              icon={<ModelAvatar label={model.label} />}
              fullWidth
            />
          )}
        </div>

        <div className="h-px bg-border-subtle" />

        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Parameters</div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1 text-xs text-foreground">
              <span>{isVideo ? "Video URL" : "Image URL"}</span>
              <Info className="h-3 w-3 text-muted" />
            </div>
            <span className="text-[11px] text-accent">* required</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder={isVideo ? "https://…mp4" : "https://…png"}
              className="flex-1 min-w-0 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-2 text-xs text-foreground placeholder:text-muted outline-none truncate"
            />
            <label className="shrink-0 flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white cursor-pointer hover:brightness-95 transition-[filter]">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Upload"}
              <input
                type="file"
                accept={isVideo ? "video/*" : "image/*"}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>

        {mediaUrl && (
          <div className="rounded-xl overflow-hidden border border-border-subtle bg-surface-2">
            {isVideo ? (
              <video src={mediaUrl} muted loop playsInline autoPlay className="w-full max-h-56 object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl} alt="" className="w-full max-h-56 object-contain" />
            )}
          </div>
        )}

        {!isVideo && model?.upscaleFactors && (
          <div>
            <div className="mb-1.5 text-xs text-foreground">Upscale Factor</div>
            <Dropdown
              value={String(upscaleFactor)}
              options={model.upscaleFactors.map((f) => ({ value: String(f), label: `${f}×` }))}
              onChange={(v) => setUpscaleFactor(Number(v))}
              fullWidth
            />
          </div>
        )}

        {isVideo && (
          <div>
            <div className="mb-1.5 text-xs text-foreground">Resolution</div>
            <Dropdown
              value={resolution}
              options={VIDEO_RESOLUTIONS.map((r) => ({ value: r, label: r }))}
              onChange={setResolution}
              fullWidth
            />
          </div>
        )}

        {isVideo && (
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm">Copy Audio</div>
              <div className="text-[11px] text-muted">
                Whether to copy the original video&apos;s audio to the upscaled video.
              </div>
            </div>
            <Toggle checked={copyAudio} onChange={setCopyAudio} />
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm">Enable Safety Checker</div>
            <div className="text-[11px] text-muted">Filter prompts that may violate content policy before they run.</div>
          </div>
          <Toggle checked={safetyChecker} onChange={setSafetyChecker} />
        </div>

        {error && <div className="text-xs text-danger-text">{formatErrorMessage(error).message}</div>}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center rounded-xl border border-border-subtle bg-surface-2 px-4 py-2.5 text-sm font-medium hover:bg-border-subtle transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !mediaUrl || !model}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40 hover:brightness-95 transition-[filter]"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Upscale · {formatCostUSD(estimatedCostUSD)}
          </button>
        </div>
      </div>
    </div>
  );
}
