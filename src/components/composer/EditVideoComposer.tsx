"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Loader2, Plus, X } from "lucide-react";
import { getModel, modelsByCategoryAndMode, type ModelConfig } from "@/lib/models";
import { estimateCostUSD, formatCostUSD, formatCostINR } from "@/lib/pricing";
import { Toggle } from "@/components/ui/Toggle";
import { Dropdown } from "@/components/ui/Dropdown";
import { AspectRatioIcon } from "@/components/ui/AspectRatioIcon";
import { ModelSelector } from "./ModelSelector";
import { ActivePresetCard, mergePresetPrompt } from "./PromptComposer";
import { useComposerStore } from "@/store/composerStore";
import { formatErrorMessage } from "@/lib/errorFormat";
import { uploadReferenceFile } from "@/lib/upload";

const DEFAULT_MODEL_ID = "kling-o1-video-edit";

export function EditVideoComposer({
  onGenerated,
  initialModelId,
  initialPrompt,
  models: modelsOverride,
  toolId,
}: {
  onGenerated?: () => void;
  /** Preselect a model — used when arriving here from the Templates page (e.g. a Kling Motion Control preset). */
  initialModelId?: string;
  /** Prefill the prompt — used alongside `initialModelId` from a template. */
  initialPrompt?: string;
  /** Narrow the model picker to a specific set (e.g. a single tool studio's curated models) instead of every v2v video model. Falls back to the full v2v list when omitted — the original "Edit Video" tab behavior. */
  models?: ModelConfig[];
  /** Tags submitted generations with a config-driven tool studio's id — see the matching prop on PromptComposer for the full rationale. */
  toolId?: string;
}) {
  const { activePreset, setActivePreset } = useComposerStore();
  const models = modelsOverride ?? modelsByCategoryAndMode("video", "v2v");
  // Falls back to this list's own first entry (not the global DEFAULT_MODEL_ID
  // constant) when a `models` override is passed — otherwise the initial
  // modelId could resolve via getModel() to a real model that simply isn't
  // in the restricted list this composer instance is scoped to.
  const [modelId, setModelId] = useState(initialModelId ?? models[0]?.id ?? DEFAULT_MODEL_ID);
  const model = getModel(modelId) ?? models[0];

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [elements, setElements] = useState<{ id: string; url: string }[]>([]);
  const [elementsUploading, setElementsUploading] = useState(false);
  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const [aspectRatio, setAspectRatio] = useState(model?.defaultAspectRatio ?? "16:9");

  // Re-apply whenever a fresh template is picked while this tab is already
  // open (initialModelId/initialPrompt only run once on mount otherwise).
  useEffect(() => {
    if (initialModelId) setModelId(initialModelId);
    if (initialPrompt !== undefined) setPrompt(initialPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialModelId, initialPrompt]);
  const [keepSound, setKeepSound] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estimatedCostUSD = model ? estimateCostUSD(model, {}) : 0;

  async function handleVideoUpload(file: File) {
    setVideoUploading(true);
    setError(null);
    try {
      const { url } = await uploadReferenceFile(file);
      setVideoUrl(url);
    } catch (err) {
      // Used to fail silently — the upload zone would just stay empty with
      // no indication why (e.g. a video over the 50MB cap). Now the real
      // error shows up here.
      setError(err instanceof Error ? err.message : "Failed to upload video");
    } finally {
      setVideoUploading(false);
    }
  }

  async function handleElementUpload(file: File) {
    if (elements.length >= (model?.maxReferences ?? 4)) return;
    setElementsUploading(true);
    setError(null);
    try {
      const { url } = await uploadReferenceFile(file);
      setElements((prev) => [...prev, { id: crypto.randomUUID(), url }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setElementsUploading(false);
    }
  }

  async function handleSubmit() {
    if (!model || isSubmitting || !videoUrl) return;
    setError(null);
    setIsSubmitting(true);
    try {
      // A selected preset's own baked-in instruction (e.g. a Motion Control
      // camera-move description) always leads, with whatever the user typed
      // in the otherwise-empty prompt box appended as extra detail — see
      // mergePresetPrompt in PromptComposer.tsx.
      const finalPrompt = mergePresetPrompt(activePreset?.prompt, prompt);
      const res = await fetch("/api/generate/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: model.id,
          prompt: finalPrompt,
          videoUrl,
          references: elements.map((e) => e.url),
          settings: { aspectRatio, keepOriginalSound: keepSound },
          toolId: toolId ?? null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Generation failed to start");
      }
      // Deliberately not clearing the video/elements/prompt here — keeping
      // them lets the user regenerate the same setup or tweak it without
      // re-uploading everything.
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
      {activePreset && <ActivePresetCard preset={activePreset} onClear={() => setActivePreset(null)} />}

      <div>
        {videoUrl ? (
          <div className="relative rounded-xl overflow-hidden border border-border-subtle bg-surface-2">
            <video src={videoUrl} muted loop playsInline autoPlay className="w-full h-32 object-cover" />
            <button
              onClick={() => setVideoUrl(null)}
              className="absolute top-2 right-2 p-1 rounded-md bg-black/60 hover:bg-black/80"
            >
              <X className="h-3.5 w-3.5 text-white" />
            </button>
          </div>
        ) : (
          <label className="w-full flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-subtle bg-surface-2 py-6 text-center hover:border-foreground/40 transition-colors cursor-pointer">
            {videoUploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted" />
            ) : (
              <span className="text-sm font-medium">Upload a video to edit</span>
            )}
            <span className="text-[11px] text-muted">Duration required: 3–10 secs</span>
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleVideoUpload(f);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 flex-wrap">
          {elements.map((el) => (
            <div key={el.id} className="relative h-14 w-14 shrink-0 rounded-lg overflow-hidden border border-border-subtle group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={el.url} alt="" className="h-full w-full object-cover" />
              <button
                onClick={() => setElements((prev) => prev.filter((e) => e.id !== el.id))}
                className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>
          ))}
          {elements.length < (model?.maxReferences ?? 4) && (
            <label className="h-14 w-14 shrink-0 rounded-lg border border-dashed border-border-subtle flex items-center justify-center text-muted hover:text-foreground hover:border-foreground/40 transition-colors cursor-pointer">
              {elementsUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleElementUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
        <p className="mt-1 text-[11px] text-muted">Upload images &amp; elements (optional) — up to {model?.maxReferences ?? 4}</p>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={
          activePreset
            ? `Add any extra detail "${activePreset.title}" might need (optional)…`
            : "Describe the edit — e.g. change the background, restyle, replace an object…"
        }
        rows={4}
        className="w-full resize-none rounded-xl border border-border-subtle bg-surface-2 text-sm text-foreground placeholder:text-muted outline-none px-3 py-2"
      />

      <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface-2 px-3 py-2">
        <span className="text-sm">Keep original sound</span>
        <Toggle checked={keepSound} onChange={setKeepSound} />
      </div>

      <Dropdown
        value={aspectRatio}
        onChange={setAspectRatio}
        options={(model?.aspectRatios ?? ["16:9", "9:16", "1:1"]).map((ar) => ({
          value: ar,
          label: ar,
          icon: <AspectRatioIcon ratio={ar} />,
        }))}
      />

      {error && <div className="text-xs text-danger-text">{formatErrorMessage(error).message}</div>}

      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !model || !videoUrl}
        className="flex items-center justify-center gap-1.5 rounded-xl bg-foreground text-background text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity w-full py-2.5"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
        {isSubmitting ? "Generating…" : "Generate"}
        {model && !isSubmitting && (
          <span className="text-xs font-normal opacity-70">
            · {formatCostUSD(estimatedCostUSD)} · {formatCostINR(estimatedCostUSD)}
          </span>
        )}
      </button>
    </div>
  );
}
