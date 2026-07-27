"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Bookmark, Loader2, X } from "lucide-react";
import { getModel, type ModelConfig } from "@/lib/models";
import { estimateCostUSD, formatCostUSD, formatCostINR } from "@/lib/pricing";
import { globeMarker } from "@/lib/wireframeGlobe";
import { ModelSelector } from "./ModelSelector";
import { PreviewStage } from "./PreviewStage";
import { CubeGlyph } from "./CubeGlyph";
import { formatErrorMessage } from "@/lib/errorFormat";
import { uploadReferenceFile } from "@/lib/upload";
import { getCameraPresets, saveCameraPreset, deleteCameraPreset, type CameraPreset } from "@/lib/cameraPresets";
import { cn } from "@/lib/utils";

// Chevron arrows snap to a fixed grid so clicking jumps between clean
// viewpoints (dragging stays continuous).
const AZIMUTH_STEP = 45;
const TILT_STEP = 15;

function snap(value: number, step: number) {
  return Math.round(value / step) * step;
}
// "Generate from 12 best angles" — a real batch feature, not decorative:
// checking it fires 12 separate generations, one per evenly-spaced azimuth
// around the subject (current Tilt/Zoom held fixed), same technique as a
// single generation just repeated. Matches the count in Higgsfield's own
// label, so the cost estimate below multiplies by exactly this.
const BEST_ANGLES_COUNT = 12;

function azimuthLabel(rotate: number): string {
  if (rotate < 20 || rotate >= 340) return "the original front-facing viewpoint";
  if (rotate < 160) return `a viewpoint rotated ${rotate}° clockwise around the subject`;
  if (rotate < 200) return "the opposite side — a rear, behind-the-subject viewpoint";
  return `a viewpoint rotated ${360 - rotate}° counter-clockwise around the subject`;
}

// `vertical` is 0-100 (matches the slider) — converted to a -90..90
// elevation-style angle for the description and for the shared orbit
// projection (see `globeMarker`): 0 -> -90 (dramatic low angle), 50 -> 0
// (eye level), 100 -> 90 (top-down).
function verticalToElevation(vertical: number): number {
  return (vertical - 50) * 1.8;
}

function verticalLabel(vertical: number): string {
  if (vertical >= 80) return "a high, top-down-leaning angle looking down at the subject";
  if (vertical >= 60) return "a slightly elevated angle, looking down gently";
  if (vertical >= 40) return "a neutral, eye-level angle";
  if (vertical >= 20) return "a slightly low angle, looking up gently";
  return "a dramatic low angle, looking up at the subject";
}

function zoomLabel(zoom: number): string {
  if (zoom === 0) return "keeping the same framing and distance";
  if (zoom > 0) return `zoomed in closer by about ${zoom}%`;
  return `zoomed out farther by about ${Math.abs(zoom)}%`;
}

function SliderRow({
  label,
  value,
  min,
  max,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="font-medium text-foreground">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
    </div>
  );
}

/**
 * Bespoke Angle Generator composer — "Change Camera" / "Angles" from
 * Higgsfield/Magnific, built with the same technique as RelightComposer:
 * a wireframe-globe preview (see PreviewStage) with a draggable cube camera
 * marker connected to the card by a straight rod, that authors a precise
 * natural-language camera-angle instruction at submit time, rather than
 * calling a dedicated novel-view-synthesis endpoint (none exists in the
 * muapi registry — same gap Relight hit). Runs on the same reference-guided
 * image edit models as Relight.
 *
 * This is a real limitation worth being upfront about: an image-edit model
 * re-imagining a new camera angle from a single 2D photo is an
 * AI reinterpretation, not true 3D reprojection — it won't perfectly
 * preserve geometry the way a dedicated view-synthesis model would. That's
 * the honest ceiling of what's buildable on top of the currently-verified
 * endpoints.
 */
export function AngleComposer({
  models,
  onGenerated,
}: {
  models: ModelConfig[];
  onGenerated?: () => void;
}) {
  const [modelId, setModelId] = useState(models[0]?.id ?? "nano-banana-2-edit");
  const model = getModel(modelId) ?? models[0];

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);

  const [rotate, setRotate] = useState(40);
  const [vertical, setVertical] = useState(50);
  const [zoom, setZoom] = useState(0);
  const [bestAngles, setBestAngles] = useState(false);

  const [presets, setPresets] = useState<CameraPreset[]>([]);
  useEffect(() => setPresets(getCameraPresets()), []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const estimatedCostUSD = model ? estimateCostUSD(model, {}) * (bestAngles ? BEST_ANGLES_COUNT : 1) : 0;

  async function handleImageUpload(file: File) {
    setImageUploading(true);
    setError(null);
    try {
      const { url } = await uploadReferenceFile(file);
      setImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setImageUploading(false);
    }
  }

  function updateFromPointer(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const maxR = Math.min(rect.width, rect.height) * 0.42;
    const dist = Math.min(Math.hypot(dx, dy), maxR);
    const ratio = maxR === 0 ? 0 : dist / maxR;
    let angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    setRotate(Math.round(angle));
    setVertical(Math.round(100 - ratio * 100));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromPointer(e);
  }
  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    updateFromPointer(e);
  }

  function handleNudge(dir: "up" | "down" | "left" | "right") {
    if (dir === "left") setRotate((r) => (snap(r, AZIMUTH_STEP) - AZIMUTH_STEP + 360) % 360);
    if (dir === "right") setRotate((r) => (snap(r, AZIMUTH_STEP) + AZIMUTH_STEP) % 360);
    if (dir === "up") setVertical((v) => Math.min(100, snap(v, TILT_STEP) + TILT_STEP));
    if (dir === "down") setVertical((v) => Math.max(0, snap(v, TILT_STEP) - TILT_STEP));
  }

  function resetStage() {
    setRotate(40);
    setVertical(50);
    setZoom(0);
  }

  function handleSavePreset() {
    const saved = saveCameraPreset({ label: `Angle ${presets.length + 1}`, rotate, vertical, zoom });
    setPresets((prev) => [saved, ...prev].slice(0, 8));
  }

  function applyPreset(p: CameraPreset) {
    setRotate(p.rotate);
    setVertical(p.vertical);
    setZoom(p.zoom);
  }

  function removePreset(id: string) {
    deleteCameraPreset(id);
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }

  function buildPrompt(rotateOverride?: number): string {
    const r = rotateOverride ?? rotate;
    return `Re-render this exact photo as if photographed from ${azimuthLabel(r)}, at ${verticalLabel(vertical)}, ${zoomLabel(zoom)}. Keep the subject, materials, colors, lighting, and identity exactly the same — only change the camera viewpoint, perspective, and framing to match this new angle, filling in any newly revealed areas naturally and photorealistically.`;
  }

  async function handleSubmit() {
    if (!model || isSubmitting || !imageUrl) return;
    const m = model;
    const photo = imageUrl;
    setError(null);
    setIsSubmitting(true);
    try {
      const angles = bestAngles
        ? Array.from({ length: BEST_ANGLES_COUNT }, (_, i) => Math.round((360 / BEST_ANGLES_COUNT) * i))
        : [rotate];
      await Promise.all(
        angles.map((r) =>
          fetch("/api/generate/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              modelId: m.id,
              prompt: buildPrompt(r),
              references: [photo],
              settings: { aspectRatio: m.defaultAspectRatio },
              // Hardcoded, not threaded as a prop — only ever rendered for
              // the "angle" tool (see BESPOKE_COMPOSERS in ToolStudioView.tsx).
              toolId: "angle",
            }),
          }).then(async (res) => {
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.error || "Generation failed to start");
            }
          })
        )
      );
      onGenerated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  const elevation = verticalToElevation(vertical);
  const pos = globeMarker(rotate, elevation);

  return (
    <div className="flex flex-col gap-3">
      <div className="panel-label">Model</div>
      {model && <ModelSelector models={models} selectedId={model.id} onSelect={setModelId} direction="down" />}

      <div>
        {imageUrl ? (
          <div className="relative overflow-hidden rounded-xl border border-border-subtle bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="h-28 w-full object-cover" />
            <button
              onClick={() => setImageUrl(null)}
              className="absolute right-2 top-2 rounded-md bg-black/60 p-1 hover:bg-black/80"
            >
              <X className="h-3.5 w-3.5 text-white" />
            </button>
          </div>
        ) : (
          <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-subtle bg-surface-2 py-6 text-center transition-colors hover:border-foreground/40">
            {imageUploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted" />
            ) : (
              <span className="text-sm font-medium">Upload a photo</span>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImageUpload(f);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface-2 p-3">
        <div className="mb-1.5 flex items-center justify-end">
          <button
            onClick={handleSavePreset}
            disabled={!imageUrl}
            className="flex items-center gap-1 text-[11px] font-medium text-accent hover:text-accent-2 disabled:opacity-40"
          >
            <Bookmark className="h-3 w-3" /> Save as preset
          </button>
        </div>

        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={() => setDragging(false)}
          onPointerLeave={() => setDragging(false)}
          className="cursor-crosshair touch-none select-none"
        >
          <PreviewStage
            imageUrl={imageUrl}
            azimuth={rotate}
            elevation={elevation}
            onReset={resetStage}
            onNudge={handleNudge}
            hint="Hold and drag to change camera angle"
          >
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full"
              style={{ zIndex: pos.behind ? 5 : 15 }}
            >
              <line
                x1={pos.x}
                y1={pos.y}
                x2={50}
                y2={50}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={0.6}
                strokeDasharray="1.5 1.5"
              />
            </svg>
            <div
              className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border border-white/40 bg-black/60 shadow-[0_0_10px_1px_rgba(255,255,255,0.25)]"
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, zIndex: pos.behind ? 5 : 20 }}
            >
              <CubeGlyph className="h-4 w-4 text-white" />
            </div>
          </PreviewStage>
        </div>

        {presets.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <div
                key={p.id}
                className="group flex items-center gap-1 rounded-lg border border-border-subtle bg-surface px-2 py-1 text-[11px] text-muted"
              >
                <button onClick={() => applyPreset(p)} className="hover:text-foreground">
                  {p.label}
                </button>
                <button onClick={() => removePreset(p.id)} className="opacity-0 group-hover:opacity-100 hover:text-danger-text">
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-2 px-3 py-2.5 text-xs cursor-pointer">
        <input
          type="checkbox"
          checked={bestAngles}
          onChange={(e) => setBestAngles(e.target.checked)}
          className="accent-accent"
        />
        <span className="text-foreground">Generate from {BEST_ANGLES_COUNT} best angles</span>
      </label>

      <div className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-2 p-4">
        <SliderRow label="Rotation" value={rotate} min={0} max={360} format={(v) => `${v}°`} onChange={setRotate} />
        <SliderRow label="Tilt" value={vertical} min={0} max={100} format={(v) => `${v}°`} onChange={setVertical} />
        <SliderRow
          label="Zoom"
          value={zoom}
          min={-50}
          max={50}
          format={(v) => (v === 0 ? "initial" : `${v > 0 ? "+" : ""}${v}%`)}
          onChange={setZoom}
        />
      </div>

      {error && <div className="text-xs text-danger-text">{formatErrorMessage(error).message}</div>}

      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !model || !imageUrl}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
        {isSubmitting ? "Generating…" : "Generate"}
        {model && !isSubmitting && (
          <span className="text-xs font-normal opacity-80">
            · {formatCostUSD(estimatedCostUSD)} · {formatCostINR(estimatedCostUSD)}
          </span>
        )}
      </button>
    </div>
  );
}
