"use client";

import { useRef, useState } from "react";
import { Brush, Eraser, Loader2, Plus, Redo2, Trash2, Undo2, X } from "lucide-react";
import { getModel } from "@/lib/models";
import { Dropdown } from "@/components/ui/Dropdown";
import { formatCostUSD, estimateCostUSD } from "@/lib/pricing";
import { formatErrorMessage } from "@/lib/errorFormat";
import { uploadReferenceFile } from "@/lib/upload";

// The 3 models this was built and requested against — see the `supportsMask`
// doc comment on ModelConfig for why generate.ts still re-verifies against
// each model's real live schema at submit time rather than trusting this
// list blind. Nano Banana 2 Edit first: it's our own `recommended` default
// everywhere else, so keeping it first here too means the default selection
// is consistent with the rest of the app.
const INPAINT_MODEL_IDS = ["nano-banana-2-edit", "nano-banana-pro-edit", "gpt-image-2-edit"];

const BRUSH_COLOR = "236, 72, 153"; // pink-500 — reads clearly over any photo content, light or dark
const MIN_PAINTED_ALPHA = 10;

function ModelAvatar({ label }: { label: string }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 border border-border-subtle text-[10px] font-semibold">
      {label.charAt(0).toUpperCase()}
    </span>
  );
}

/** Reads back the visible (colored, translucent) paint canvas and produces a
 * plain black/white PNG blob at the canvas's native pixel size — white where
 * anything was painted (any alpha above the threshold), black everywhere
 * else. White-paint-is-editable is the majority convention across
 * inpainting APIs; see the polarity caveat in generate.ts's MASK_CANDIDATES
 * comment if a real submission turns out to need the opposite. */
function exportMask(canvas: HTMLCanvasElement): Promise<Blob> {
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = canvas.width;
  maskCanvas.height = canvas.height;
  const mctx = maskCanvas.getContext("2d")!;
  const src = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
  const dst = mctx.createImageData(canvas.width, canvas.height);
  for (let i = 0; i < src.data.length; i += 4) {
    const v = src.data[i + 3] > MIN_PAINTED_ALPHA ? 255 : 0;
    dst.data[i] = v;
    dst.data[i + 1] = v;
    dst.data[i + 2] = v;
    dst.data[i + 3] = 255;
  }
  mctx.putImageData(dst, 0, 0);
  return new Promise((resolve, reject) =>
    maskCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to export mask"))), "image/png")
  );
}

function canvasHasPaint(canvas: HTMLCanvasElement): boolean {
  const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > MIN_PAINTED_ALPHA) return true;
  }
  return false;
}

/**
 * Higgsfield-style masked inpainting, opened from a completed generation's
 * hover toolbar: paint over the region to change, describe the change,
 * generate — everything outside the painted region stays untouched.
 *
 * Mechanically this is a normal edit-model submission (same /api/generate/
 * image route every other tool uses) with one extra field: a black/white
 * mask PNG uploaded alongside the source image. See generate.ts's
 * MASK_CANDIDATES comment for how the real mask field name is resolved per
 * model, and models.ts's `supportsMask` doc comment for which models this
 * is wired to.
 */
export function InpaintModal({
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
  const models = INPAINT_MODEL_IDS.map((id) => getModel(id)).filter((m): m is NonNullable<typeof m> => !!m);
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const model = models.find((m) => m.id === modelId) ?? models[0];

  const [prompt, setPrompt] = useState("");
  const [tool, setTool] = useState<"brush" | "eraser">("brush");
  const [brushSize, setBrushSize] = useState(36);
  const [hasPaint, setHasPaint] = useState(false);
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  const [secondaryRefUrl, setSecondaryRefUrl] = useState<string | null>(null);
  const [uploadingRef, setUploadingRef] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const estimatedCostUSD = model ? estimateCostUSD(model, {}) : 0;

  function syncCanvasSize() {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || !img.naturalWidth) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
  }

  function getCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function drawSegment(from: { x: number; y: number }, to: { x: number; y: number }) {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const scaleX = canvas.width / canvas.getBoundingClientRect().width;
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = `rgba(${BRUSH_COLOR}, 0.55)`;
    ctx.lineWidth = brushSize * scaleX;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  function pushHistory() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setHistoryStack((prev) => [...prev.slice(-29), canvas.toDataURL()]);
    setRedoStack([]);
  }

  function restoreFrom(dataUrl: string | undefined) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!dataUrl) {
      setHasPaint(false);
      return;
    }
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setHasPaint(canvasHasPaint(canvas));
    };
    img.src = dataUrl;
  }

  function handleUndo() {
    if (historyStack.length === 0) return;
    const canvas = canvasRef.current;
    const current = canvas?.toDataURL();
    const prevState = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, -1));
    if (current) setRedoStack((prev) => [...prev, current]);
    restoreFrom(prevState);
  }

  function handleRedo() {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    const canvas = canvasRef.current;
    const current = canvas?.toDataURL();
    if (current) setHistoryStack((prev) => [...prev, current]);
    restoreFrom(nextState);
  }

  function handleClearAll() {
    pushHistory();
    restoreFrom(undefined);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    pushHistory();
    drawingRef.current = true;
    const pt = getCanvasPoint(e);
    lastPointRef.current = pt;
    drawSegment(pt, { x: pt.x + 0.01, y: pt.y + 0.01 }); // a tap alone still leaves a dot
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !lastPointRef.current) return;
    const pt = getCanvasPoint(e);
    drawSegment(lastPointRef.current, pt);
    lastPointRef.current = pt;
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    canvasRef.current?.releasePointerCapture(e.pointerId);
    const canvas = canvasRef.current;
    if (canvas) setHasPaint(canvasHasPaint(canvas));
  }

  async function handleUploadSecondaryRef(file: File) {
    setUploadingRef(true);
    setError(null);
    try {
      const { url } = await uploadReferenceFile(file);
      setSecondaryRefUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image — check your connection and try again");
    } finally {
      setUploadingRef(false);
    }
  }

  async function handleSubmit() {
    const canvas = canvasRef.current;
    if (!model || !canvas || submitting) return;
    if (!hasPaint) {
      setError("Paint over the area you want to change first.");
      return;
    }
    if (!prompt.trim()) {
      setError("Describe what should replace the painted area.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const maskBlob = await exportMask(canvas);
      const maskFile = new File([maskBlob], "mask.png", { type: "image/png" });
      const { url: maskUrl } = await uploadReferenceFile(maskFile);

      const references = [imageUrl, ...(secondaryRefUrl ? [secondaryRefUrl] : [])];

      const res = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: model.id,
          prompt: prompt.trim(),
          references,
          maskUrl,
          settings: {},
          projectId: projectId ?? null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Inpaint failed to start");
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
        className="flex w-full max-w-5xl max-h-[90vh] flex-col gap-4 overflow-y-auto rounded-2xl border border-border-subtle bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Inpaint</span>
          <button onClick={onClose} className="icon-btn-round" title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="text-[11px] text-muted -mt-2">
          Paint over the area to change, then describe what should replace it — everything outside the painted area stays untouched.
        </div>

        {/* Canvas: the image renders at its natural aspect ratio inside a
            capped-height box so tall/wide sources don't blow out the modal;
            the paint canvas is sized in JS to the image's real pixel
            dimensions (see syncCanvasSize) and CSS-stretched to match, so
            painted strokes stay pixel-accurate to the source regardless of
            how small the on-screen preview is. */}
        <div className="relative mx-auto max-h-[46vh] w-fit overflow-hidden rounded-xl border border-border-subtle bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt=""
            onLoad={syncCanvasSize}
            className="block max-h-[46vh] w-auto select-none"
            draggable={false}
          />
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
          />
        </div>

        {/* Paint toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2 p-1">
            <button
              onClick={() => setTool("brush")}
              title="Brush"
              className={`p-1.5 rounded-md ${tool === "brush" ? "bg-accent text-white" : "hover:bg-border-subtle"}`}
            >
              <Brush className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setTool("eraser")}
              title="Eraser"
              className={`p-1.5 rounded-md ${tool === "eraser" ? "bg-accent text-white" : "hover:bg-border-subtle"}`}
            >
              <Eraser className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5">
            <span className="text-[11px] text-muted whitespace-nowrap">Brush size</span>
            <input
              type="range"
              min={8}
              max={100}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-24 accent-accent"
            />
          </div>

          <button
            onClick={handleUndo}
            disabled={historyStack.length === 0}
            title="Undo"
            className="p-1.5 rounded-lg border border-border-subtle bg-surface-2 hover:bg-border-subtle disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title="Redo"
            className="p-1.5 rounded-lg border border-border-subtle bg-surface-2 hover:bg-border-subtle disabled:opacity-40"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleClearAll}
            disabled={!hasPaint}
            title="Clear all"
            className="flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2 px-2 py-1.5 text-[11px] hover:bg-border-subtle disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear all
          </button>
        </div>

        <div className="h-px bg-border-subtle" />

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">Model</div>
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

        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">
              Describe the change
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={'e.g. "replace with a red leather handbag" or "remove this object"…'}
              rows={2}
              className="w-full resize-none rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-2 text-xs text-foreground placeholder:text-muted outline-none"
            />
          </div>
          <label
            title="Add an optional reference image (e.g. a product to insert)"
            className="shrink-0 flex items-center justify-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-xs font-medium cursor-pointer hover:bg-border-subtle transition-colors"
          >
            {uploadingRef ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {secondaryRefUrl ? "Reference added" : "Add reference"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUploadSecondaryRef(f);
                e.target.value = "";
              }}
            />
          </label>
          {secondaryRefUrl && (
            <button
              onClick={() => setSecondaryRefUrl(null)}
              title="Remove reference"
              className="shrink-0 icon-btn-round"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
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
            disabled={submitting || !hasPaint || !prompt.trim() || !model}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40 hover:brightness-95 transition-[filter]"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Generate · {formatCostUSD(estimatedCostUSD)}
          </button>
        </div>
      </div>
    </div>
  );
}
