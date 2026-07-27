"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { getModel } from "@/lib/models";
import { Dropdown } from "@/components/ui/Dropdown";
import { formatCostUSD, estimateCostUSD } from "@/lib/pricing";
import { formatErrorMessage } from "@/lib/errorFormat";
import { uploadReferenceFile } from "@/lib/upload";
import { cn } from "@/lib/utils";

// Same masked-edit models Inpaint uses — generative expand is mechanically
// outpaint: give the model a larger canvas with the original placed inside
// and a mask marking the new (empty) border, and it fills the border to
// continue the scene. See generate.ts MASK_CANDIDATES for how the mask field
// is resolved per model.
const EXPAND_MODEL_IDS = ["nano-banana-2-edit", "nano-banana-pro-edit", "gpt-image-2-edit"];

type Sides = "all" | "horizontal" | "vertical";
const AMOUNTS = [0.25, 0.5, 1] as const;

function ModelAvatar({ label }: { label: string }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 border border-border-subtle text-[10px] font-semibold">
      {label.charAt(0).toUpperCase()}
    </span>
  );
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // needed so the canvas isn't tainted when we read it back
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load the image for expanding — its host may block cross-origin reads."));
    img.src = url;
  });
}

function canvasToUploadedUrl(canvas: HTMLCanvasElement, name: string): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error("Failed to build image"));
      try {
        const { url } = await uploadReferenceFile(new File([blob], name, { type: "image/png" }));
        resolve(url);
      } catch (e) {
        reject(e);
      }
    }, "image/png");
  });
}

/**
 * Generative expand (outpaint) — opened from a completed image's toolbar.
 * Pick how far to grow the canvas and on which sides; the modal builds a
 * bigger source image (original centered) plus a black/white mask of the new
 * border, then submits to a masked-edit model that fills the border to
 * extend the scene. Reuses the exact same /api/generate/image + mask path as
 * Inpaint — no new backend.
 */
export function ExpandModal({
  imageUrl,
  projectId,
  onClose,
  onSubmitted,
}: {
  imageUrl: string;
  projectId?: string | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const models = EXPAND_MODEL_IDS.map((id) => getModel(id)).filter((m): m is NonNullable<typeof m> => !!m);
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const model = models.find((m) => m.id === modelId) ?? models[0];

  const [sides, setSides] = useState<Sides>("all");
  const [amount, setAmount] = useState<number>(0.5);
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Original image's natural size — needed so the preview frame can take the
  // *new* canvas's aspect ratio (see below). Defaults to a square until load.
  const [imgSize, setImgSize] = useState<{ w: number; h: number }>({ w: 1, h: 1 });

  const estimatedCostUSD = model ? estimateCostUSD(model, {}) : 0;

  // Preview geometry. The dashed frame represents the *new* (expanded) canvas
  // and is sized by aspect-ratio inside a fixed-height, clipped box — so it can
  // never grow past the preview and spill onto the controls below (the bug with
  // the old %-padding approach, where vertical padding is % of *width* and had
  // no height cap). The original image sits centered at a fraction of the frame.
  const padXFrac = sides !== "vertical" ? amount : 0;
  const padYFrac = sides !== "horizontal" ? amount : 0;
  const newAspect = (imgSize.w * (1 + 2 * padXFrac)) / (imgSize.h * (1 + 2 * padYFrac));
  const innerWPct = 100 / (1 + 2 * padXFrac);
  const innerHPct = 100 / (1 + 2 * padYFrac);

  async function handleSubmit() {
    if (!model || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const img = await loadImage(imageUrl);
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      const padX = sides !== "vertical" ? Math.round(W * amount) : 0;
      const padY = sides !== "horizontal" ? Math.round(H * amount) : 0;
      const newW = W + padX * 2;
      const newH = H + padY * 2;

      // Source: original centered on the enlarged transparent canvas.
      const src = document.createElement("canvas");
      src.width = newW;
      src.height = newH;
      src.getContext("2d")!.drawImage(img, padX, padY, W, H);

      // Mask: white = fill (the new border), black = keep (the original box).
      const mask = document.createElement("canvas");
      mask.width = newW;
      mask.height = newH;
      const mctx = mask.getContext("2d")!;
      mctx.fillStyle = "#ffffff";
      mctx.fillRect(0, 0, newW, newH);
      mctx.fillStyle = "#000000";
      mctx.fillRect(padX, padY, W, H);

      const [sourceUrl, maskUrl] = await Promise.all([
        canvasToUploadedUrl(src, "expand-source.png"),
        canvasToUploadedUrl(mask, "expand-mask.png"),
      ]);

      const res = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: model.id,
          prompt:
            prompt.trim() ||
            "Extend and continue this scene naturally into the new area — seamless, consistent lighting, perspective and style with the original.",
          references: [sourceUrl],
          maskUrl,
          settings: { aspectRatio: `${newW}:${newH}` },
          projectId: projectId ?? null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Expand failed to start");
      }
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] bg-black/85 flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div
        className="flex w-full max-w-lg max-h-[92vh] flex-col gap-4 overflow-y-auto rounded-2xl border border-border-subtle bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Generative expand</span>
          <button onClick={onClose} className="icon-btn-round" title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="-mt-2 text-[11px] text-muted">
          Grow the canvas and let the model fill the new space, continuing the scene beyond the original edges.
        </div>

        {/* Preview: the dashed frame is the new canvas; the original sits inside
            it. Fixed height + overflow-hidden guarantees it stays put. */}
        <div className="mx-auto flex h-[38vh] w-full items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-surface-2 p-4">
          <div
            className="relative h-full max-h-full max-w-full rounded-md border border-dashed border-accent/60 bg-accent/5"
            style={{ aspectRatio: String(newAspect) }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              onLoad={(e) => {
                const t = e.currentTarget;
                if (t.naturalWidth && t.naturalHeight) setImgSize({ w: t.naturalWidth, h: t.naturalHeight });
              }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm object-cover"
              style={{ width: `${innerWPct}%`, height: `${innerHPct}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Direction</span>
          <div className="flex gap-1.5">
            {(["all", "horizontal", "vertical"] as Sides[]).map((s) => (
              <button
                key={s}
                onClick={() => setSides(s)}
                className={cn(
                  "flex-1 rounded-lg border px-2.5 py-1.5 text-xs capitalize transition-colors",
                  sides === s
                    ? "border-accent/60 bg-accent/10 text-foreground"
                    : "border-border-subtle bg-surface-2 text-muted hover:text-foreground"
                )}
              >
                {s === "all" ? "All sides" : s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Amount</span>
          <div className="flex gap-1.5">
            {AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => setAmount(a)}
                className={cn(
                  "flex-1 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                  amount === a
                    ? "border-accent/60 bg-accent/10 text-foreground"
                    : "border-border-subtle bg-surface-2 text-muted hover:text-foreground"
                )}
              >
                +{Math.round(a * 100)}%
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Model</div>
          {model && (
            <Dropdown
              value={model.id}
              options={models.map((m) => ({ value: m.id, label: m.label }))}
              onChange={setModelId}
              icon={<ModelAvatar label={model.label} />}
              fullWidth
            />
          )}
        </div>

        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
            What's beyond the edges? (optional)
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={'e.g. "more forest and a misty mountain range" — leave blank to just continue the scene'}
            rows={2}
            className="w-full resize-none rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-2 text-xs text-foreground placeholder:text-muted outline-none"
          />
        </div>

        {error && <div className="text-xs text-danger-text">{formatErrorMessage(error).message}</div>}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border-subtle bg-surface-2 px-4 py-2.5 text-sm font-medium hover:bg-border-subtle transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !model}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40 hover:brightness-95 transition-[filter]"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Expand · {formatCostUSD(estimatedCostUSD)}
          </button>
        </div>
      </div>
    </div>
  );
}
