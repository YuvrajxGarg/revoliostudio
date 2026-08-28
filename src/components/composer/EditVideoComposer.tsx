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
import { ExtraParamControls } from "./ExtraParamControls";
import { MediaReferenceList } from "./MediaReferenceList";
import { useComposerStore } from "@/store/composerStore";
import { useModelSchema } from "@/hooks/useModelSchema";
import { formatErrorMessage } from "@/lib/errorFormat";
import { uploadReferenceFile } from "@/lib/upload";

const DEFAULT_MODEL_ID = "seedance-2-video-edit";

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
  // Generic live-schema extras (see src/lib/extra-params.ts) — this composer
  // doesn't use the shared composer store, so they live in local state and
  // reset on model switch. This is how wan2.7-video-edit's negative_prompt +
  // audio_setting and Kling motion-control's character_orientation surface.
  const [extraParams, setExtraParams] = useState<Record<string, string | number | boolean>>({});
  const [negativePrompt, setNegativePrompt] = useState("");
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [duration, setDuration] = useState<number | undefined>(undefined);
  // Audio reference(s) — Seedance 2.0 Video Edit's audio_files / 2.5's
  // audios_list, shown only when the live schema confirms the field.
  const [audioRefs, setAudioRefs] = useState<{ id: string; url: string; name: string }[]>([]);
  const [audioUploading, setAudioUploading] = useState(false);

  const schema = useModelSchema(model?.id);
  const schemaOk = !!schema && !schema.error;
  // Live schema wins for the reference-elements cap (same reasoning as
  // PromptComposer's maxRefs) — registry value while loading/errored.
  const refCap = (schemaOk ? schema.maxReferenceImages : null) ?? model?.maxReferences ?? 4;
  // A few v2v models (Kling motion-control, face swap, dance effects,
  // reframe) take a single image_url instead of images_list — see the v2v
  // branch of buildPayload. Their registry entries cap maxReferences at 1.
  const audioRefField = schemaOk ? schema.audioRefField : null;
  // Duration control, live-schema-driven with the same precedence as
  // SettingsBar: a min/max slider when the schema has bounds (e.g. Seedance
  // 2.5 Video Edit's 4-30s int), the schema's discrete enum otherwise, the
  // registry's static list while loading/errored, and no control at all for
  // schema-confirmed models without a duration field.
  const durationSlider = schemaOk ? schema.duration : null;
  const durationOptions = schemaOk
    ? schema.hasDurationField
      ? (schema.durationOptions ?? model?.durations ?? null)
      : null
    : (model?.durations ?? null);
  const currentDuration =
    duration ??
    durationSlider?.default ??
    (schemaOk ? schema.defaultDuration : null) ??
    model?.defaultDuration ??
    durationOptions?.[0];

  // Same stale-value guard as SettingsBar's extraParams pruning: a toggle
  // flipped on one model must not ride into the next model's submit.
  useEffect(() => {
    setExtraParams({});
    setNegativePrompt("");
    setSeed(undefined);
    setDuration(undefined);
    setAudioRefs([]);
  }, [modelId]);

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

  // Per-second models (the whole Seedance 2.5 Video Edit family) need the
  // selected duration or the button shows the 5s price for a 30s clip.
  const estimatedCostUSD = model ? estimateCostUSD(model, { duration: currentDuration }) : 0;

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
    if (elements.length >= refCap) return;
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

  async function handleAudioUpload(file: File) {
    if (!audioRefField || audioRefs.length >= audioRefField.max) return;
    setAudioUploading(true);
    setError(null);
    try {
      const { url, name } = await uploadReferenceFile(file);
      setAudioRefs((prev) => [...prev, { id: crypto.randomUUID(), url, name }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload audio");
    } finally {
      setAudioUploading(false);
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
          audioUrls: audioRefs.length ? audioRefs.map((a) => a.url) : undefined,
          settings: {
            aspectRatio,
            duration: currentDuration,
            keepOriginalSound: keepSound,
            seed,
            negativePrompt: negativePrompt.trim() || undefined,
            extraParams: Object.keys(extraParams).length ? extraParams : undefined,
          },
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
          {elements.length < refCap && (
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
        <p className="mt-1 text-[11px] text-muted">Upload images &amp; elements (optional) — up to {refCap}</p>
      </div>

      {/* Audio reference(s), schema-gated — Seedance 2.0 Video Edit's
          audio_files / 2.5 (480p)'s audios_list. */}
      {audioRefField && (
        <MediaReferenceList
          kind="audio"
          label={audioRefField.isArray ? "Audio references (optional)" : "Audio reference (optional)"}
          items={audioRefs}
          max={audioRefField.max}
          uploading={audioUploading}
          onUpload={handleAudioUpload}
          onRemove={(id) => setAudioRefs((prev) => prev.filter((a) => a.id !== id))}
        />
      )}

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

      {/* Seedance's video-edit has no keep_original_sound field (audio is a
          separate input), so hide the toggle for models that don't support it
          rather than show a control that does nothing. */}
      {model?.supportsKeepSound !== false && (
        <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface-2 px-3 py-2">
          <span className="text-sm">Keep original sound</span>
          <Toggle checked={keepSound} onChange={setKeepSound} />
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Dropdown
          value={aspectRatio}
          onChange={setAspectRatio}
          options={(model?.aspectRatios ?? ["16:9", "9:16", "1:1"]).map((ar) => ({
            value: ar,
            label: ar,
            icon: <AspectRatioIcon ratio={ar} />,
          }))}
        />
        {durationSlider ? (
          <div className="control-pill">
            <input
              type="range"
              min={durationSlider.min}
              max={durationSlider.max}
              step={durationSlider.step}
              value={currentDuration ?? durationSlider.default}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-20 slider-thin"
            />
            <span className="tabular-nums w-9 text-right">{currentDuration ?? durationSlider.default}s</span>
          </div>
        ) : (
          durationOptions &&
          durationOptions.length > 0 && (
            <Dropdown
              value={String(currentDuration ?? durationOptions[0])}
              options={durationOptions.map((d) => ({ value: String(d), label: `${d}s` }))}
              onChange={(v) => setDuration(Number(v))}
              panelTitle="Duration"
            />
          )
        )}
      </div>

      {/* Generic live-schema extras — see the extraParams state above. */}
      <div className="flex flex-wrap items-center gap-2 empty:hidden">
        <ExtraParamControls
          schema={schema}
          values={extraParams}
          onChange={(field, value) => setExtraParams((prev) => ({ ...prev, [field]: value }))}
          negativePrompt={negativePrompt}
          onNegativePromptChange={setNegativePrompt}
          seed={seed}
          onSeedChange={setSeed}
          direction="down"
        />
      </div>

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
