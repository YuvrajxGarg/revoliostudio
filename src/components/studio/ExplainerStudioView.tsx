"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ImagePlus,
  LayoutGrid,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  Wand2,
  Workflow,
  X,
} from "lucide-react";
import { uploadReferenceFile } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { formatErrorMessage } from "@/lib/errorFormat";
import { useGenerations } from "@/hooks/useGenerations";
import { GenerationGrid } from "@/components/gallery/GenerationGrid";
import { GenerationCard } from "@/components/gallery/GenerationCard";
import { GridSizeSlider } from "@/components/gallery/GridSizeSlider";
import { usePersistentState } from "@/hooks/usePersistentState";
import type { Generation } from "@/lib/types";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import type { ExplainerBreakdown } from "@/app/api/explainer/breakdown/route";
import {
  EXPLAINER_STYLES,
  EXPLAINER_ASPECT_RATIOS,
  DEFAULT_EXPLAINER_STYLE,
  DEFAULT_EXPLAINER_ASPECT_RATIO,
  MAX_SHOTS,
} from "@/lib/explainerPresets";
import { THUMBNAIL_MODEL_FAMILIES, DEFAULT_THUMBNAIL_MODEL_FAMILY } from "@/lib/thumbnailModels";

const TOOL_ID = "explainer";
const MAX_STYLE_REFERENCES = 4;

interface ShotState {
  id: string;
  caption: string;
  visual: string;
  durationSeconds: number;
  generationId?: string;
  submitting: boolean;
  error?: string | null;
}

function newShot(partial?: Partial<ShotState>): ShotState {
  return { id: crypto.randomUUID(), caption: "", visual: "", durationSeconds: 3, submitting: false, ...partial };
}

type Step = 1 | 2 | 3;

const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: "Script & Style" },
  { id: 2, label: "Shots" },
  { id: 3, label: "Render" },
];

export function ExplainerStudioView() {
  const [step, setStep] = useState<Step>(1);

  // Step 1 — script & style
  const [script, setScript] = useState("");
  const [styleId, setStyleId] = useState<string>(DEFAULT_EXPLAINER_STYLE);
  const [customStyle, setCustomStyle] = useState(false);
  const [styleCustom, setStyleCustom] = useState("");
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_EXPLAINER_ASPECT_RATIO);
  const [styleReferenceUrls, setStyleReferenceUrls] = useState<string[]>([]);
  const [styleRefUploading, setStyleRefUploading] = useState(false);
  const [breakingDown, setBreakingDown] = useState(false);
  const [breakdownTitle, setBreakdownTitle] = useState("");

  // Step 2 — shots
  const [shots, setShots] = useState<ShotState[]>([]);

  // Step 3 — render
  const [modelFamily, setModelFamily] = useState(DEFAULT_THUMBNAIL_MODEL_FAMILY);
  const [bakeCaptions, setBakeCaptions] = useState(false);
  const [renderingAll, setRenderingAll] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);
  const [colWidth, setColWidth] = usePersistentState("revolio-grid-width", 220);
  const [mainTab, setMainTab] = useState<"generate" | "gallery">("generate");

  const { items, loading, hasMore, loadMore, prepend, removeItem, pollNow } = useGenerations(undefined, {
    toolId: TOOL_ID,
  });

  // Every shot's live Generation, looked up from the same polled list that
  // backs the Gallery tab — no separate polling loop needed for the
  // storyboard grid, it just reads whatever useGenerations already has.
  const generationByShot = useMemo(() => {
    const map = new Map<string, Generation>();
    for (const shot of shots) {
      if (!shot.generationId) continue;
      const g = items.find((i) => i.id === shot.generationId);
      if (g) map.set(shot.id, g);
    }
    return map;
  }, [shots, items]);

  async function handleAddStyleReference(file: File) {
    if (styleReferenceUrls.length >= MAX_STYLE_REFERENCES) return;
    setStyleRefUploading(true);
    setError(null);
    try {
      const { url } = await uploadReferenceFile(file);
      setStyleReferenceUrls((prev) => [...prev, url]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload reference");
    } finally {
      setStyleRefUploading(false);
    }
  }

  function removeStyleReference(url: string) {
    setStyleReferenceUrls((prev) => prev.filter((u) => u !== url));
  }

  async function handleBreakdown() {
    if (!script.trim() || breakingDown) return;
    setBreakingDown(true);
    setError(null);
    try {
      const res = await fetch("/api/explainer/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, styleReferenceUrl: styleReferenceUrls[0] ?? null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Breakdown failed");
      }
      const result = (await res.json()) as ExplainerBreakdown;
      setBreakdownTitle(result.title);
      setShots(result.shots.map((s) => newShot({ caption: s.caption, visual: s.visual, durationSeconds: s.durationSeconds })));
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Breakdown failed");
    } finally {
      setBreakingDown(false);
    }
  }

  function updateShot(id: string, patch: Partial<ShotState>) {
    setShots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function moveShot(id: string, dir: -1 | 1) {
    setShots((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function removeShot(id: string) {
    setShots((prev) => (prev.length > 1 ? prev.filter((s) => s.id !== id) : prev));
  }

  function addShot() {
    if (shots.length >= MAX_SHOTS) return;
    setShots((prev) => [...prev, newShot()]);
  }

  async function renderShot(shot: ShotState) {
    updateShot(shot.id, { submitting: true, error: null });
    try {
      const res = await fetch("/api/explainer/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visual: shot.visual,
          caption: shot.caption,
          bakeCaption: bakeCaptions,
          styleId: customStyle ? "custom" : styleId,
          styleCustom,
          aspectRatio,
          styleReferenceUrls,
          modelFamily,
          numVariations: 1,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Render failed to start");
      }
      const submitted = (await res.json()) as Generation;
      prepend(submitted);
      pollNow(submitted.id);
      updateShot(shot.id, { generationId: submitted.id, submitting: false });
    } catch (err) {
      updateShot(shot.id, { submitting: false, error: err instanceof Error ? err.message : "Render failed to start" });
    }
  }

  async function renderAll() {
    if (renderingAll) return;
    setRenderingAll(true);
    setError(null);
    for (const shot of shots) {
      if (!shot.visual.trim()) continue;
      await renderShot(shot);
    }
    setRenderingAll(false);
  }

  function goToStep(target: Step) {
    setError(null);
    setStep(target);
  }

  function handleNext() {
    if (step === 1 && shots.length === 0) {
      setError('Break down your script with Claude first — click "Break down with Claude" above.');
      return;
    }
    if (step === 2 && shots.every((s) => !s.visual.trim())) {
      setError("At least one shot needs a visual description");
      return;
    }
    setError(null);
    setStep((s) => (s < 3 ? ((s + 1) as Step) : s));
  }

  function handleReset() {
    setStep(1);
    setScript("");
    setStyleId(DEFAULT_EXPLAINER_STYLE);
    setCustomStyle(false);
    setStyleCustom("");
    setAspectRatio(DEFAULT_EXPLAINER_ASPECT_RATIO);
    setStyleReferenceUrls([]);
    setBreakdownTitle("");
    setShots([]);
    setModelFamily(DEFAULT_THUMBNAIL_MODEL_FAMILY);
    setBakeCaptions(false);
    setError(null);
  }

  const stepCard = (
    <>
      {/* Step 1 — Script & Style */}
      {step === 1 && (
        <div className="flex flex-col gap-3">
          <div>
            <div className="panel-label mb-1.5">Script or topic</div>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={7}
              placeholder="Paste a full narration script, or just describe the topic — e.g. “How compound interest works”."
              className="w-full resize-y rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-2 text-xs leading-relaxed outline-none placeholder:text-muted focus:border-accent"
            />
          </div>

          <div>
            <div className="panel-label mb-1.5">Visual style</div>
            <div className="flex flex-wrap gap-1.5">
              {EXPLAINER_STYLES.map((s) => (
                <button
                  key={s.id}
                  title={s.tagline}
                  onClick={() => {
                    setStyleId(s.id);
                    setCustomStyle(false);
                  }}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    !customStyle && styleId === s.id
                      ? "border-accent/60 bg-accent/10 text-foreground"
                      : "border-border-subtle bg-surface-2 text-muted hover:text-foreground"
                  )}
                >
                  {s.label}
                </button>
              ))}
              <button
                onClick={() => setCustomStyle(true)}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                  customStyle
                    ? "border-accent/60 bg-accent/10 text-foreground"
                    : "border-border-subtle bg-surface-2 text-muted hover:text-foreground"
                )}
              >
                Custom
              </button>
            </div>
            {customStyle && (
              <input
                value={styleCustom}
                onChange={(e) => setStyleCustom(e.target.value)}
                placeholder="Describe the visual style you want…"
                className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-xs outline-none placeholder:text-muted focus:border-accent"
              />
            )}
          </div>

          <div>
            <div className="panel-label mb-1.5">Aspect ratio</div>
            <div className="flex flex-wrap gap-1.5">
              {EXPLAINER_ASPECT_RATIOS.map((ar) => (
                <button
                  key={ar.id}
                  onClick={() => setAspectRatio(ar.id)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    aspectRatio === ar.id
                      ? "border-accent/60 bg-accent/10 text-foreground"
                      : "border-border-subtle bg-surface-2 text-muted hover:text-foreground"
                  )}
                >
                  {ar.label}
                  {ar.note && <span className="ml-1 text-[10px] text-muted">{ar.note}</span>}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="panel-label mb-1.5">Style references · optional</div>
            <p className="mb-1.5 text-[11px] text-muted leading-relaxed">
              Upload up to {MAX_STYLE_REFERENCES} images whose look you want every shot to share — a brand kit page,
              an icon set, a frame you like. The first one also helps Claude write shot descriptions that fit.
            </p>
            <div className="flex flex-wrap gap-2">
              {styleReferenceUrls.map((url) => (
                <div key={url} className="relative h-14 w-14 shrink-0 rounded-lg overflow-hidden border border-border-subtle">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    onClick={() => setViewingUrl(url)}
                    className="h-full w-full object-cover cursor-pointer hover:brightness-90"
                  />
                  <button
                    onClick={() => removeStyleReference(url)}
                    className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-border-subtle bg-surface text-foreground shadow-md hover:bg-danger/10 hover:text-danger-text"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
              {styleReferenceUrls.length < MAX_STYLE_REFERENCES && (
                <label className="flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border-subtle text-muted hover:text-foreground hover:border-foreground/40">
                  {styleRefUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleAddStyleReference(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          <button
            onClick={handleBreakdown}
            disabled={!script.trim() || breakingDown}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-accent/60 bg-accent/10 px-3 py-2.5 text-sm font-semibold text-accent hover:bg-accent/20 transition-colors disabled:opacity-40"
          >
            {breakingDown ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {breakingDown ? "Thinking through shots…" : shots.length > 0 ? "Redo breakdown with Claude" : "Break down with Claude"}
          </button>
        </div>
      )}

      {/* Step 2 — Shots */}
      {step === 2 && (
        <div className="flex flex-col gap-3">
          <div>
            <div className="panel-label mb-1.5">Title</div>
            <input
              value={breakdownTitle}
              onChange={(e) => setBreakdownTitle(e.target.value)}
              placeholder="Untitled explainer"
              className="w-full rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-sm font-medium outline-none placeholder:text-muted focus:border-accent"
            />
          </div>

          <div className="flex flex-col gap-2.5">
            {shots.map((shot, i) => (
              <div key={shot.id} className="rounded-xl border border-border-subtle bg-surface-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">Shot {i + 1}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      value={shot.durationSeconds}
                      onChange={(e) => updateShot(shot.id, { durationSeconds: Math.max(1, Number(e.target.value) || 1) })}
                      className="w-12 rounded-md border border-border-subtle bg-surface px-1.5 py-0.5 text-[11px] outline-none focus:border-accent"
                    />
                    <span className="text-[10px] text-muted">s</span>
                    <button onClick={() => moveShot(shot.id, -1)} disabled={i === 0} className="text-muted hover:text-foreground disabled:opacity-30">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => moveShot(shot.id, 1)} disabled={i === shots.length - 1} className="text-muted hover:text-foreground disabled:opacity-30">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    {shots.length > 1 && (
                      <button onClick={() => removeShot(shot.id)} className="text-muted hover:text-danger-text">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <input
                  value={shot.caption}
                  onChange={(e) => updateShot(shot.id, { caption: e.target.value })}
                  placeholder="On-screen line / voiceover…"
                  className="mt-2 w-full rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 text-xs outline-none placeholder:text-muted focus:border-accent"
                />
                <textarea
                  value={shot.visual}
                  onChange={(e) => updateShot(shot.id, { visual: e.target.value })}
                  rows={2}
                  placeholder="What's on screen — icons, diagram, metaphor…"
                  className="mt-1.5 w-full resize-none rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 text-xs leading-relaxed outline-none placeholder:text-muted focus:border-accent"
                />
              </div>
            ))}

            {shots.length < MAX_SHOTS && (
              <button
                onClick={addShot}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-subtle py-2 text-xs text-muted hover:text-foreground hover:border-foreground/40"
              >
                <Plus className="h-3.5 w-3.5" /> Add shot
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 3 — Render */}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          <div>
            <div className="panel-label mb-1.5">Image model</div>
            <div className="flex flex-col gap-1.5">
              {THUMBNAIL_MODEL_FAMILIES.map((family) => (
                <button
                  key={family.id}
                  onClick={() => setModelFamily(family.id)}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-left transition-colors",
                    modelFamily === family.id
                      ? "border-accent/60 bg-accent/10"
                      : "border-border-subtle bg-surface-2 hover:border-foreground/30"
                  )}
                >
                  <span className="text-xs font-medium">{family.label}</span>
                  <span className="text-[10px] text-muted">{family.tagline}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="panel-label mb-1.5">Bake on-screen text into every frame?</div>
            <div className="flex gap-1.5">
              {([false, true] as const).map((v) => (
                <button
                  key={String(v)}
                  onClick={() => setBakeCaptions(v)}
                  className={cn(
                    "flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    bakeCaptions === v
                      ? "border-accent/60 bg-accent/10 text-foreground"
                      : "border-border-subtle bg-surface-2 text-muted hover:text-foreground"
                  )}
                >
                  {v ? "Yes, bake captions" : "No text (recommended)"}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={renderAll}
            disabled={renderingAll || shots.every((s) => !s.visual.trim())}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-40 hover:bg-accent-2 transition-colors py-2.5"
          >
            {renderingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {renderingAll ? "Rendering…" : "Render all shots"}
          </button>

          {/* The storyboard so far — only shown here, on the Render step
              itself, once shots exist. Each panel resolves its live
              Generation straight from the shared, already-polling
              useGenerations list (generationByShot), so no separate polling
              loop is needed here. */}
          <div>
            <div className="panel-label mb-1.5">Storyboard</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {shots.map((shot, i) => {
                const gen = generationByShot.get(shot.id);
                return (
                  <div key={shot.id} className="flex flex-col gap-1.5 rounded-xl border border-border-subtle bg-surface-2 p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-muted">Shot {i + 1}</span>
                      <button
                        title="Render / re-render this shot"
                        onClick={() => renderShot(shot)}
                        disabled={shot.submitting || !shot.visual.trim()}
                        className="flex items-center gap-1 rounded-md border border-border-subtle px-1.5 py-0.5 text-[10px] text-muted hover:text-foreground disabled:opacity-40"
                      >
                        {shot.submitting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <RefreshCw className="h-2.5 w-2.5" />}
                        {gen ? "Redo" : "Render"}
                      </button>
                    </div>
                    {gen ? (
                      <GenerationCard generation={gen} onDeleted={removeItem} />
                    ) : (
                      <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border-subtle text-center text-[10px] text-muted px-2">
                        {shot.submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Not rendered yet"}
                      </div>
                    )}
                    {shot.caption && <p className="line-clamp-2 text-[10px] text-muted">{shot.caption}</p>}
                    {shot.error && <p className="text-[10px] text-danger-text">{formatErrorMessage(shot.error).message}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-3 pb-6 pt-3">
      {/* Banner header — Community-style: icon chip + title + tagline, with
          the Generate/Gallery pill toggle on the right. Always centered to
          the wizard body's column width, independent of which tab is
          active (Gallery breaks out to the full stage width below; this
          header never does), so it reads as the whole panel's title bar. */}
      <div className="mx-auto mb-4 w-full max-w-2xl shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-5 md:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Workflow className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Explainer Storyboard</h1>
              <p className="mt-0.5 text-xs text-muted">Turn a script into a rendered shot-by-shot storyboard</p>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-border-subtle bg-surface-2 p-1">
            <button
              onClick={() => setMainTab("generate")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                mainTab === "generate" ? "bg-accent text-white" : "text-muted hover:text-foreground"
              )}
            >
              <Wand2 className="h-3.5 w-3.5" /> Generate
            </button>
            <button
              onClick={() => setMainTab("gallery")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                mainTab === "gallery" ? "bg-accent text-white" : "text-muted hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Gallery
              {items.length > 0 && <span className="text-[10px] opacity-70">({items.length})</span>}
            </button>
          </div>
        </div>
      </div>

      {mainTab === "gallery" ? (
        <div className="flex flex-col gap-3">
          {items.length > 0 && (
            <div className="flex justify-end">
              <GridSizeSlider value={colWidth} onChange={setColWidth} />
            </div>
          )}
          <GenerationGrid
            items={items}
            loading={loading}
            hasMore={hasMore}
            onLoadMore={loadMore}
            emptyLabel="Your rendered shots will appear here — walk through Script & Style, Shots, and Render."
            onDeleted={removeItem}
            columnWidth={colWidth}
          />
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          {/* Stepper — boxed to match the header/content cards, so the
              whole thing reads as one continuous window instead of loose
              floating pieces. */}
          <div className="rounded-2xl border border-border-subtle bg-surface p-4">
            <div className="flex items-center justify-center">
              {STEPS.map((s, i) => (
                <div key={s.id} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")}>
                  <button
                    onClick={() => goToStep(s.id)}
                    className={cn(
                      "flex items-center gap-2 whitespace-nowrap text-sm font-medium",
                      step === s.id ? "text-accent" : step > s.id ? "text-foreground/70" : "text-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-[11px]",
                        step === s.id ? "bg-accent text-white" : step > s.id ? "bg-foreground/20" : "bg-surface-2"
                      )}
                    >
                      {step > s.id ? <Check className="h-3 w-3" /> : s.id}
                    </span>
                    {s.label}
                  </button>
                  {i < STEPS.length - 1 && <div className="mx-3 h-px flex-1 bg-border-subtle" />}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border-subtle/60 bg-surface/50 backdrop-blur-md shadow-lg p-5">
            {stepCard}
          </div>

          {error && <div className="text-xs text-danger-text">{formatErrorMessage(error).message}</div>}

          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                onClick={() => goToStep((step - 1) as Step)}
                className="flex items-center justify-center gap-1 rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-medium hover:bg-surface-2"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            )}
            {step < 3 && (
              <button
                onClick={handleNext}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-2 transition-colors py-2.5"
              >
                Next <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border-subtle px-3 py-2 text-xs font-medium text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Start over
          </button>
        </div>
      )}

      {viewingUrl && <ImageLightbox url={viewingUrl} onClose={() => setViewingUrl(null)} />}
    </div>
  );
}
