"use client";

import { useRef, useState } from "react";
import { ArrowUp, Check, Loader2, Palette, Plus, Type, X } from "lucide-react";
import { uploadReferenceFile } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { formatErrorMessage } from "@/lib/errorFormat";
import { useGenerations } from "@/hooks/useGenerations";
import { GenerationGrid } from "@/components/gallery/GenerationGrid";
import { GridSizeSlider } from "@/components/gallery/GridSizeSlider";
import { usePersistentState } from "@/hooks/usePersistentState";
import type { Generation } from "@/lib/types";
import { ImageLightbox } from "@/components/ui/ImageLightbox";

// Every generation submitted from this studio is tagged with this tool id
// (see supabase/migrations/0019_tool_scoping_and_audio.sql) so its gallery
// only ever shows what Typography Generator itself created — not every
// image made with the same underlying GPT Image 2 / Nano Banana 2 models
// via the plain Image Generator or another tool studio.
const TOOL_ID = "typography";

// Transparent output: GPT Image 2, using OpenAI's native `background:
// "transparent"` request param (the real Images API lever for a genuine
// alpha-channel PNG — not just prompt wording, which alone tends to make
// image models draw a literal checkerboard graphic instead of real
// transparency). Non-transparent: Nano Banana 2 on a flat chroma-key green.
const TRANSPARENT_MODEL_ID = "gpt-image-2-edit";
const GREEN_SCREEN_MODEL_ID = "nano-banana-2-edit";
const CHROMA_GREEN = "#00FF00";
const MAX_REFS = 4;

type Step = "idle" | "submitting";

function buildPrompt(text: string, transparent: boolean, colorOverride: string | null, details: string) {
  let p =
    `Study the exact typography style shown in the reference image(s) — the font shape, weight, ` +
    `letter spacing, color, texture, outline, glow, or any special effect applied to the lettering. ` +
    `Render the following text in that exact same style, centered: "${text.trim()}".`;

  p += transparent
    ? ` Place it on a fully transparent background with a real alpha channel — no background color, texture or checkerboard pattern of any kind, just the isolated styled text.`
    : ` Place it on a completely flat, solid chroma-key green background (${CHROMA_GREEN}), evenly lit with no gradient, shadow, or texture in the background — just the isolated styled text.`;

  if (colorOverride) p += ` Use ${colorOverride} as the color of the new text, overriding whatever color the reference used.`;
  if (details.trim()) p += ` ${details.trim()}`;
  p += ` Keep the composition minimal — only the styled text, nothing else in frame.`;
  return p;
}

export function TypographyStudioView() {
  const [refs, setRefs] = useState<{ id: string; url: string }[]>([]);
  const [refUploading, setRefUploading] = useState(false);
  const [text, setText] = useState("");
  const [details, setDetails] = useState("");
  const [transparent, setTransparent] = useState(false);
  const [colorEnabled, setColorEnabled] = useState(false);
  const [color, setColor] = useState("#e85002");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [colWidth, setColWidth] = usePersistentState("revolio-grid-width", 220);
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // This tool's own gallery — scoped by tool_id (see TOOL_ID above) so it
  // only ever shows generations made here, same pattern every other tool
  // studio uses (see ToolStudioView.tsx), rather than the single one-shot
  // preview this view used to be limited to.
  const { items, loading, hasMore, loadMore, prepend, removeItem, pollNow } = useGenerations(undefined, {
    toolId: TOOL_ID,
  });

  const busy = step === "submitting";

  async function handleUpload(file: File) {
    if (refs.length >= MAX_REFS) return;
    setRefUploading(true);
    setError(null);
    try {
      const { url } = await uploadReferenceFile(file);
      setRefs((prev) => [...prev, { id: crypto.randomUUID(), url }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setRefUploading(false);
    }
  }

  async function handleGenerate() {
    if (busy || refs.length === 0 || !text.trim()) return;
    setError(null);
    setStep("submitting");
    try {
      const modelId = transparent ? TRANSPARENT_MODEL_ID : GREEN_SCREEN_MODEL_ID;
      const prompt = buildPrompt(text, transparent, colorEnabled ? color : null, details);
      const submitRes = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId,
          prompt,
          references: refs.map((r) => r.url),
          settings: { aspectRatio: "1:1", transparentBackground: transparent },
          toolId: TOOL_ID,
        }),
      });
      if (!submitRes.ok) {
        const data = await submitRes.json().catch(() => ({}));
        throw new Error(data.error || "Generation failed to start");
      }
      const submitted = (await submitRes.json()) as Generation;
      // Fire-and-forget from here — same pattern as every other composer:
      // drop the freshly-queued row straight into the gallery and let
      // useGenerations' own polling (plus this one immediate poll) carry it
      // from "queued" through to "completed", instead of blocking this
      // handler (and the Generate button) on a client-side poll loop.
      prepend(submitted);
      pollNow(submitted.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setStep("idle");
    }
  }

  return (
    <div className="flex-1 flex min-h-0 gap-3 px-3 pb-3 pt-3">
      <aside className="hidden lg:flex w-[320px] shrink-0 flex-col gap-4 rounded-2xl border border-border-subtle/60 bg-surface/50 backdrop-blur-md shadow-lg overflow-y-auto p-4">
        <div>
          <h1 className="text-sm font-semibold flex items-center gap-1.5">
            <Type className="h-4 w-4" /> Typography Generator
          </h1>
          <p className="mt-1 text-xs text-muted leading-relaxed">
            Upload one or more images of a text/lettering style you like, type the words you want, and get a PNG
            rendered in that exact font, color and effect.
          </p>
        </div>

        <div>
          <div className="panel-label mb-1.5">Style reference(s)</div>
          <div className="flex flex-wrap items-center gap-2">
            {refs.map((r) => (
              <div key={r.id} className="relative h-16 w-16 shrink-0 rounded-lg overflow-hidden border border-border-subtle">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.url}
                  alt=""
                  title="Click to view full size"
                  onClick={() => setViewingUrl(r.url)}
                  className="h-full w-full object-cover cursor-pointer hover:brightness-90 transition-[filter]"
                />
                <button
                  onClick={() => setRefs((prev) => prev.filter((x) => x.id !== r.id))}
                  title="Remove"
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border-subtle bg-surface text-foreground shadow-md hover:bg-danger/10 hover:text-danger-text hover:border-danger/40 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {refs.length < MAX_REFS && (
              <button
                onClick={() => inputRef.current?.click()}
                disabled={refUploading}
                className="h-16 w-16 shrink-0 rounded-lg border border-dashed border-border-subtle flex items-center justify-center text-muted hover:text-foreground hover:border-foreground/40 transition-colors disabled:opacity-50"
              >
                {refUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>
            )}
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
          </div>
          <p className="mt-1 text-[11px] text-muted">Up to {MAX_REFS} images — the clearer the lettering, the better the match.</p>
        </div>

        <div>
          <div className="panel-label mb-1.5">Text to render</div>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. SUMMER SALE"
            maxLength={80}
            className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent/60 transition-colors"
          />
        </div>

        <div>
          <button
            onClick={() => setTransparent((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-border-subtle bg-surface-2 px-3 py-2"
          >
            <span className="text-sm">Transparent background</span>
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                transparent ? "bg-accent border-accent" : "border-border-subtle"
              )}
            >
              {transparent && <Check className="h-3 w-3 text-white" />}
            </span>
          </button>
          <p className="mt-1 text-[11px] text-muted">
            {transparent
              ? "Uses GPT Image 2 to export a real alpha-channel PNG directly."
              : "Off — uses Nano Banana 2 and renders on a solid green screen, ready to key out yourself."}
          </p>
        </div>

        <div>
          <button
            onClick={() => setColorEnabled((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-border-subtle bg-surface-2 px-3 py-2"
          >
            <span className="flex items-center gap-1.5 text-sm">
              <Palette className="h-3.5 w-3.5 text-muted" /> Override text color
            </span>
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                colorEnabled ? "bg-accent border-accent" : "border-border-subtle"
              )}
            >
              {colorEnabled && <Check className="h-3 w-3 text-white" />}
            </span>
          </button>
          {colorEnabled && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-9 shrink-0 rounded-lg border border-border-subtle bg-transparent cursor-pointer"
              />
              <span className="text-xs text-muted font-mono">{color}</span>
            </div>
          )}
        </div>

        <div>
          <div className="panel-label mb-1.5">Extra details (optional)</div>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Anything to add or ignore — e.g. “ignore the drop shadow”, “make it bolder”…"
            rows={3}
            className="w-full resize-none rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent/60 transition-colors"
          />
        </div>

        {error && <div className="text-xs text-danger-text">{formatErrorMessage(error).message}</div>}

        <button
          onClick={handleGenerate}
          disabled={busy || refs.length === 0 || !text.trim()}
          className="mt-auto flex items-center justify-center gap-1.5 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-40 hover:bg-accent-2 transition-colors w-full py-2.5"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          {busy ? "Submitting…" : "Generate"}
        </button>
      </aside>

      {/* Main stage — this tool's own gallery, scoped to tool_id "typography"
          (see TOOL_ID above), same pattern as every other tool studio's
          gallery instead of a single one-shot preview. */}
      <div className="flex-1 flex flex-col min-w-0 rounded-2xl border border-border-subtle/60 bg-surface/30 backdrop-blur-md shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border-subtle/60 shrink-0">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Type className="h-4 w-4 text-muted" /> Typography Generator
          </div>
          {items.length > 0 && <GridSizeSlider value={colWidth} onChange={setColWidth} />}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <GenerationGrid
            items={items}
            loading={loading}
            hasMore={hasMore}
            onLoadMore={loadMore}
            emptyLabel="Your typography slates will appear here — upload a style reference, type your text, and generate."
            onDeleted={removeItem}
            columnWidth={colWidth}
          />
        </div>
      </div>

      {viewingUrl && <ImageLightbox url={viewingUrl} onClose={() => setViewingUrl(null)} />}
    </div>
  );
}
