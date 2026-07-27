"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowUp, Loader2, Plus, X } from "lucide-react";
import { getModel, type ModelConfig } from "@/lib/models";
import { estimateCostUSD, formatCostUSD, formatCostINR } from "@/lib/pricing";
import { globeMarker } from "@/lib/wireframeGlobe";
import { ModelSelector } from "./ModelSelector";
import { PreviewStage } from "./PreviewStage";
import { CubeGlyph } from "./CubeGlyph";
import { formatErrorMessage } from "@/lib/errorFormat";
import { uploadReferenceFile } from "@/lib/upload";
import { cn } from "@/lib/utils";

interface Light {
  id: string;
  rotate: number; // azimuth, 0-360
  elevation: number; // -90 (below) .. 90 (overhead)
  intensity: number; // 0-10, matches the reference UI's scale
  color: string;
}

const MAX_LIGHTS = 3;
// Chevron arrows snap to a fixed grid — clicking rotates/tilts to the next
// clean multiple, so it feels like snapping between defined viewpoints
// (dragging stays fully continuous).
const AZIMUTH_STEP = 45;
const ELEVATION_STEP = 30;

function snap(value: number, step: number) {
  return Math.round(value / step) * step;
}

function newLight(rotate = 0, elevation = 20, color = "#ffffff"): Light {
  return { id: crypto.randomUUID(), rotate, elevation, intensity: 5, color };
}

const QUICK_POSITIONS: { id: string; label: string; rotate: number; elevation: number }[] = [
  { id: "top", label: "Top", rotate: 0, elevation: 90 },
  { id: "front", label: "Front", rotate: 0, elevation: 20 },
  { id: "right", label: "Right", rotate: 90, elevation: 20 },
  { id: "left", label: "Left", rotate: 270, elevation: 20 },
  { id: "back", label: "Back", rotate: 180, elevation: 20 },
  { id: "bottom", label: "Bottom", rotate: 0, elevation: -90 },
];

const LIGHT_COLORS = ["#ffffff", "#ffb84d", "#ff5a36", "#3d7bff"];

const RESOLUTIONS = ["1K", "2K", "4K"];

// Where on the *card's own surface* this light's glow should land — a much
// smaller-radius version of the same azimuth/elevation projection, kept
// inside the card's box (0-100 relative to the card, not the stage) so
// PreviewStage can render it as a clipped, blended highlight — the "light
// actually bounces off the image" effect.
function cardHighlightPos(rotate: number, elevation: number) {
  const rad = (rotate * Math.PI) / 180;
  const x = 50 + 55 * Math.sin(rad);
  const y = 50 - (elevation / 90) * 55 + Math.cos(rad) * 10;
  return { x: Math.min(96, Math.max(4, x)), y: Math.min(96, Math.max(4, y)) };
}

// Turns the rotate/elevation dial state into a plain-English light
// direction — this (plus color/intensity/count) is the whole trick that
// makes Relight work on a real, already-verified image-edit model instead
// of a bespoke muapi endpoint: the interactive controls just author a
// precise natural-language lighting instruction.
function describePosition(rotate: number, elevation: number): string {
  if (elevation <= -60) return "directly underneath the subject, uplighting from below";
  if (elevation >= 75) return "directly overhead, top-down lighting";
  const dir =
    rotate < 45 || rotate >= 315
      ? "in front of the subject"
      : rotate < 135
        ? "to the right of the subject"
        : rotate < 225
          ? "behind the subject (backlighting / rim light)"
          : "to the left of the subject";
  const height = elevation > 45 ? "high above" : elevation > 10 ? "slightly above" : "at eye level with";
  return `${dir}, positioned ${height} it`;
}

function SliderRow({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="font-medium text-foreground">
          {value}
          {suffix}
        </span>
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
 * Bespoke Relight composer — mirrors Higgsfield/Magnific's Relight tool:
 * upload photo, Relight / Light transfer modes, a wireframe-globe preview
 * (see PreviewStage) with a draggable cube light marker + a fan of light
 * rays reaching the card, quick position select, per-light color/rotate/
 * elevation/intensity, up to 3 simultaneous lights. Unlike every other tool
 * in `toolStudios.ts`, this can't be expressed as a PromptComposer config —
 * the whole premise is a rich interactive light preview, not a text box.
 *
 * There's no dedicated "relight" endpoint in the muapi registry, so this
 * runs on a real, already-verified reference-guided image edit model
 * (nano-banana-2-edit by default) — the light controls just compose a
 * precise natural-language relighting instruction at submit time via
 * `buildPrompt()`, and Light Transfer mode sends the uploaded photo plus a
 * second "lighting reference" image as two `images_list` references. Posts
 * to `/api/generate/image` the same way PromptComposer.handleSubmit does.
 */
export function RelightComposer({
  models,
  onGenerated,
}: {
  models: ModelConfig[];
  onGenerated?: () => void;
}) {
  const [modelId, setModelId] = useState(models[0]?.id ?? "nano-banana-2-edit");
  const model = getModel(modelId) ?? models[0];

  const [mode, setMode] = useState<"relight" | "transfer">("relight");

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [lightRefUrl, setLightRefUrl] = useState<string | null>(null);
  const [lightRefUploading, setLightRefUploading] = useState(false);

  const [lights, setLights] = useState<Light[]>([newLight(55, 25, LIGHT_COLORS[0])]);
  const [selectedLightId, setSelectedLightId] = useState(lights[0].id);
  const selectedLight = lights.find((l) => l.id === selectedLightId) ?? lights[0];

  const [numImages, setNumImages] = useState(1);
  const [resolution, setResolution] = useState("2K");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const estimatedCostUSD = model ? estimateCostUSD(model, { resolution, numImages }) : 0;

  function updateSelectedLight(patch: Partial<Light>) {
    setLights((prev) => prev.map((l) => (l.id === selectedLightId ? { ...l, ...patch } : l)));
  }

  function addLight() {
    if (lights.length >= MAX_LIGHTS) return;
    const color = LIGHT_COLORS[lights.length % LIGHT_COLORS.length];
    const angle = (360 / MAX_LIGHTS) * lights.length;
    const light = newLight(Math.round(angle), 20, color);
    setLights((prev) => [...prev, light]);
    setSelectedLightId(light.id);
  }

  function removeLight(id: string) {
    if (lights.length <= 1) return;
    setLights((prev) => {
      const next = prev.filter((l) => l.id !== id);
      if (id === selectedLightId) setSelectedLightId(next[0].id);
      return next;
    });
  }

  function resetStage() {
    const fresh = newLight(55, 25, LIGHT_COLORS[0]);
    setLights([fresh]);
    setSelectedLightId(fresh.id);
  }

  async function handleImageUpload(file: File, target: "main" | "ref") {
    const setUploading = target === "main" ? setImageUploading : setLightRefUploading;
    const setUrl = target === "main" ? setImageUrl : setLightRefUrl;
    setUploading(true);
    setError(null);
    try {
      const { url } = await uploadReferenceFile(file);
      setUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploading(false);
    }
  }

  // Single source of truth for the dial: dragging on the stage, clicking a
  // Quick position, using the edge chevrons, or moving the Rotate/Elevation
  // sliders all just set the selected light's `rotate`/`elevation` — its
  // screen position is always derived from them via `globeMarker`, never
  // stored separately.
  function updateFromPointer(clientX: number, clientY: number) {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const maxR = Math.min(rect.width, rect.height) * 0.42;
    const dist = Math.min(Math.hypot(dx, dy), maxR);
    const ratio = maxR === 0 ? 0 : dist / maxR;
    let nextRotate = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (nextRotate < 0) nextRotate += 360;
    const nextElevation = Math.round(90 * (1 - ratio));
    updateSelectedLight({ rotate: Math.round(nextRotate), elevation: nextElevation });
  }

  function handlePointerDown(e: React.PointerEvent) {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateFromPointer(e.clientX, e.clientY);
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    updateFromPointer(e.clientX, e.clientY);
  }
  function handlePointerUp() {
    dragging.current = false;
  }

  function handleNudge(dir: "up" | "down" | "left" | "right") {
    if (dir === "left") updateSelectedLight({ rotate: (snap(selectedLight.rotate, AZIMUTH_STEP) - AZIMUTH_STEP + 360) % 360 });
    if (dir === "right") updateSelectedLight({ rotate: (snap(selectedLight.rotate, AZIMUTH_STEP) + AZIMUTH_STEP) % 360 });
    if (dir === "up") updateSelectedLight({ elevation: Math.min(90, snap(selectedLight.elevation, ELEVATION_STEP) + ELEVATION_STEP) });
    if (dir === "down") updateSelectedLight({ elevation: Math.max(-90, snap(selectedLight.elevation, ELEVATION_STEP) - ELEVATION_STEP) });
  }

  function applyQuickPosition(qp: (typeof QUICK_POSITIONS)[number]) {
    updateSelectedLight({ rotate: qp.rotate, elevation: qp.elevation });
  }

  const activePositionId = useMemo(() => {
    const match = QUICK_POSITIONS.find(
      (qp) => qp.rotate === selectedLight.rotate && qp.elevation === selectedLight.elevation
    );
    return match?.id ?? null;
  }, [selectedLight.rotate, selectedLight.elevation]);

  function buildPrompt(): string {
    if (mode === "transfer") {
      return "Transfer the lighting, color grading, and mood from the second reference image onto the first image. Keep the subject, composition, identity, and pose of the first image exactly the same — only change the lighting, shadows, highlights, and color tone to naturally match the second image's lighting style.";
    }
    const ordinals = ["a first", "a second", "a third"];
    const lightDescs = lights
      .map((l, i) => {
        const label = lights.length > 1 ? ordinals[i] ?? `a ${i + 1}th` : "a";
        return `${label} light source ${describePosition(l.rotate, l.elevation)}, casting ${l.color} colored light at roughly ${l.intensity * 10}% intensity`;
      })
      .join("; ");
    return `Relight this photo with ${lights.length === 1 ? "a single light source" : `${lights.length} distinct light sources`}: ${lightDescs}. Keep the subject, composition, identity, and pose exactly the same — only change the lighting, shadows, and highlights to naturally and photorealistically match these new light directions and colors.`;
  }

  async function handleSubmit() {
    if (!model || isSubmitting || !imageUrl) return;
    if (mode === "transfer" && !lightRefUrl) {
      setError("Add a second reference image with the lighting style to copy.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const references = mode === "transfer" ? [imageUrl, lightRefUrl as string] : [imageUrl];
      const res = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: model.id,
          prompt: buildPrompt(),
          references,
          settings: { aspectRatio: model.defaultAspectRatio, resolution, numImages },
          // Hardcoded, not threaded as a prop — this composer is only ever
          // rendered for the "relight" tool (see BESPOKE_COMPOSERS in
          // ToolStudioView.tsx), so its own gallery, and only its own
          // gallery, should show these results.
          toolId: "relight",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Generation failed to start");
      }
      // Deliberately not clearing image/refs/lights — same reasoning as
      // EditVideoComposer: lets the user tweak one light and regenerate
      // without re-uploading.
      onGenerated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="panel-label">Model</div>
      {model && <ModelSelector models={models} selectedId={model.id} onSelect={setModelId} direction="down" />}

      <div className="flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2 p-1">
        <button
          onClick={() => setMode("relight")}
          className={cn(
            "flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            mode === "relight" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
          )}
        >
          Relight
        </button>
        <button
          onClick={() => setMode("transfer")}
          className={cn(
            "flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            mode === "transfer" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
          )}
        >
          Light transfer
        </button>
      </div>

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
              <span className="text-sm font-medium">Upload a photo to relight</span>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImageUpload(f, "main");
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>

      {mode === "transfer" && (
        <div>
          <p className="mb-1.5 text-[11px] text-muted">Reference image — the lighting style to copy</p>
          {lightRefUrl ? (
            <div className="relative overflow-hidden rounded-xl border border-border-subtle bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lightRefUrl} alt="" className="h-24 w-full object-cover" />
              <button
                onClick={() => setLightRefUrl(null)}
                className="absolute right-2 top-2 rounded-md bg-black/60 p-1 hover:bg-black/80"
              >
                <X className="h-3.5 w-3.5 text-white" />
              </button>
            </div>
          ) : (
            <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-subtle bg-surface-2 py-5 text-center transition-colors hover:border-foreground/40">
              {lightRefUploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted" />
              ) : (
                <span className="flex items-center gap-1 text-xs font-medium">
                  <Plus className="h-3.5 w-3.5" /> Add lighting reference
                </span>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageUpload(f, "ref");
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
      )}

      {mode === "relight" && (
        <>
          <div className="rounded-2xl border border-border-subtle bg-surface-2 p-3">
            <div className="mb-2 grid grid-cols-3 gap-1.5">
              {QUICK_POSITIONS.map((qp) => (
                <button
                  key={qp.id}
                  onClick={() => applyQuickPosition(qp)}
                  className={cn(
                    "rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                    activePositionId === qp.id
                      ? "border-accent/60 bg-accent/15 text-accent"
                      : "border-border-subtle bg-surface text-muted hover:text-foreground"
                  )}
                >
                  {qp.label}
                </button>
              ))}
            </div>

            <div
              ref={stageRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className="cursor-crosshair touch-none select-none"
            >
              <PreviewStage
                imageUrl={imageUrl}
                azimuth={selectedLight.rotate}
                elevation={selectedLight.elevation}
                onReset={resetStage}
                onNudge={handleNudge}
                hint="Hold and drag to change light direction"
                highlights={lights.map((l) => {
                  const hp = cardHighlightPos(l.rotate, l.elevation);
                  return { x: hp.x, y: hp.y, color: l.color, intensity: l.intensity };
                })}
              >
                {lights.map((l) => {
                  const pos = globeMarker(l.rotate, l.elevation);
                  const dx = 50 - pos.x;
                  const dy = 50 - pos.y;
                  const dist = Math.max(Math.hypot(dx, dy), 1);
                  const baseAngle = Math.atan2(dy, dx);
                  const isSelected = l.id === selectedLightId;
                  // A fan of individual ray lines (not a solid triangle) —
                  // reads much more like Higgsfield's crisp light rays than
                  // a flat gradient cone did.
                  const rayCount = 6;
                  const spreadRad = (11 * Math.PI) / 180;
                  const rayLen = dist * 0.82;
                  return (
                    <div
                      key={l.id}
                      className="absolute inset-0"
                      style={{ zIndex: pos.behind ? 5 : 15, pointerEvents: "none" }}
                    >
                      <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        className="absolute inset-0 h-full w-full overflow-visible"
                      >
                        {Array.from({ length: rayCount }).map((_, i) => {
                          const t = i / (rayCount - 1) - 0.5; // -0.5..0.5
                          const a = baseAngle + t * 2 * spreadRad;
                          const ex = pos.x + Math.cos(a) * rayLen;
                          const ey = pos.y + Math.sin(a) * rayLen;
                          const centerFade = 1 - Math.abs(t) * 1.4;
                          return (
                            <line
                              key={i}
                              x1={pos.x}
                              y1={pos.y}
                              x2={ex}
                              y2={ey}
                              stroke={l.color}
                              strokeWidth={0.6}
                              strokeLinecap="round"
                              strokeOpacity={Math.max(0.05, (l.intensity / 10) * centerFade * (pos.behind ? 0.25 : 0.55))}
                            />
                          );
                        })}
                      </svg>
                      <div
                        className={cn(
                          "absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border transition-transform",
                          isSelected ? "border-white/70 scale-110" : "border-white/20"
                        )}
                        style={{
                          left: `${pos.x}%`,
                          top: `${pos.y}%`,
                          backgroundColor: "rgba(20,20,22,0.85)",
                          boxShadow: isSelected ? `0 0 10px 1px ${l.color}` : undefined,
                        }}
                      >
                        <CubeGlyph className="h-4 w-4" style={{ color: l.color }} />
                      </div>
                    </div>
                  );
                })}
              </PreviewStage>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-2 p-4">
            <div className="flex items-center justify-between">
              <div className="panel-label">Light settings</div>
              <div className="flex items-center gap-1">
                {lights.map((l, i) => (
                  <button
                    key={l.id}
                    onClick={() => setSelectedLightId(l.id)}
                    onDoubleClick={() => removeLight(l.id)}
                    title={lights.length > 1 ? `Light ${i + 1} — double-click to remove` : `Light ${i + 1}`}
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-md border text-[11px] font-semibold transition-colors",
                      l.id === selectedLightId
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-border-subtle bg-surface text-muted hover:text-foreground"
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
                {lights.length < MAX_LIGHTS && (
                  <button
                    onClick={addLight}
                    title="Add another light"
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-border-subtle text-muted hover:text-foreground"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-xs text-muted">Color</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {LIGHT_COLORS.map((hex) => (
                  <button
                    key={hex}
                    onClick={() => updateSelectedLight({ color: hex })}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-transform",
                      selectedLight.color === hex ? "border-accent scale-110" : "border-border-subtle hover:scale-105"
                    )}
                    style={{ backgroundColor: hex }}
                  />
                ))}
                <label className="relative h-6 w-6 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-border-subtle">
                  <input
                    type="color"
                    value={selectedLight.color}
                    onChange={(e) => updateSelectedLight({ color: e.target.value })}
                    className="absolute -left-1 -top-1 h-8 w-8 cursor-pointer opacity-0"
                  />
                  <span
                    className="absolute inset-0"
                    style={{
                      background:
                        "conic-gradient(from 0deg, #ff5a36, #ffb84d, #4ade80, #3d7bff, #9b5cff, #ff5ca8, #ff5a36)",
                    }}
                  />
                </label>
              </div>
            </div>

            <SliderRow
              label="Rotate"
              value={selectedLight.rotate}
              min={0}
              max={360}
              suffix="°"
              onChange={(v) => updateSelectedLight({ rotate: v })}
            />
            <SliderRow
              label="Elevation"
              value={selectedLight.elevation}
              min={-90}
              max={90}
              suffix="°"
              onChange={(v) => updateSelectedLight({ elevation: v })}
            />
            <SliderRow
              label="Intensity"
              value={selectedLight.intensity}
              min={0}
              max={10}
              suffix=""
              onChange={(v) => updateSelectedLight({ intensity: v })}
            />

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Images per generation</span>
              <div className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-1 py-1">
                <button
                  onClick={() => setNumImages((c) => Math.max(1, c - 1))}
                  className="flex h-5 w-5 items-center justify-center rounded text-muted hover:text-foreground"
                >
                  −
                </button>
                <span className="w-4 text-center text-xs font-medium">{numImages}</span>
                <button
                  onClick={() => setNumImages((c) => Math.min(4, c + 1))}
                  className="flex h-5 w-5 items-center justify-center rounded text-muted hover:text-foreground"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Resolution</span>
              <div className="flex items-center gap-1 rounded-lg border border-border-subtle bg-surface p-0.5">
                {RESOLUTIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setResolution(r)}
                    className={cn(
                      "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                      resolution === r ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {error && <div className="text-xs text-danger-text">{formatErrorMessage(error).message}</div>}

      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !model || !imageUrl || (mode === "transfer" && !lightRefUrl)}
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
