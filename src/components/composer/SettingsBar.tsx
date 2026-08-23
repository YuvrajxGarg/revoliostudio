"use client";

import { useEffect } from "react";
import { Minus, MicOff, Plus, Proportions, Sparkles, Tag, Volume2 } from "lucide-react";
import { ModelConfig } from "@/lib/models";
import { useComposerStore } from "@/store/composerStore";
import { Dropdown } from "@/components/ui/Dropdown";
import { Toggle } from "@/components/ui/Toggle";
import { AspectRatioIcon } from "@/components/ui/AspectRatioIcon";
import { ExtraParamControls } from "./ExtraParamControls";
import type { ModelSchemaInfo } from "@/lib/model-schema-types";

// Magnific-style friendly names shown beside each ratio in the menu.
const RATIO_NAMES: Record<string, string> = {
  "1:1": "Square",
  "16:9": "Widescreen",
  "9:16": "Social story",
  "2:3": "Portrait",
  "3:4": "Traditional",
  "1:2": "Vertical",
  "2:1": "Horizontal",
  "4:5": "Social post",
  "3:2": "Standard",
  "4:3": "Classic",
  "21:9": "Cinematic",
};

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="control-pill !px-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-border-subtle disabled:opacity-30"
      >
        <Minus className="h-3 w-3" />
      </button>
      <span className="min-w-[2.25rem] text-center tabular-nums">
        {value}/{max}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-border-subtle disabled:opacity-30"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

export function SettingsBar({
  model,
  schema,
  direction = "up",
}: {
  model: ModelConfig | undefined;
  /** Fetched once by the parent composer (shared with the reference-image cap) rather than re-fetched here. */
  schema: ModelSchemaInfo | null;
  /** Which way the pill dropdowns (aspect ratio, resolution, duration) open. */
  direction?: "up" | "down";
}) {
  const { settings, updateSettings } = useComposerStore();

  const schemaOk = !!schema && !schema.error;

  // Aspect ratios: once the live schema loads, it's ground truth BOTH ways —
  // it widens registry lists that hardcode fewer ratios than the API
  // accepts, and it hides the dropdown entirely for "ghost" models whose
  // schema has no aspect_ratio concept at all (a 2026-08 audit found 72 of
  // the former and 33 of the latter). Width/height-sized models get a
  // synthetic list (see sizeFromAspectRatio on ModelSchemaInfo). While the
  // schema is loading or errored, the registry list keeps working as before.
  const aspectRatios = schemaOk ? schema.aspectRatios : (model?.aspectRatios ?? null);
  const defaultAspectRatio = (schemaOk ? schema.defaultAspectRatio : model?.defaultAspectRatio) ?? aspectRatios?.[0];

  // Prefer live duration constraints from muapi's own schema — a real
  // min-to-max slider when the schema has bounds, or its discrete enum
  // (which several models publish wider than the registry's static list,
  // e.g. Sora 2's 4–20s vs the registry's 5/10). A schema-confirmed model
  // with NO duration field at all hides the control; registry list is the
  // loading/error fallback.
  const durationSlider = schema?.duration;
  const durationOptions = schemaOk
    ? schema.hasDurationField
      ? (schema.durationOptions ?? model?.durations ?? null)
      : null
    : (model?.durations ?? null);
  const currentDuration =
    settings.duration ?? durationSlider?.default ?? (schemaOk ? schema.defaultDuration : null) ?? model?.defaultDuration;

  const resolutionOptions = schema?.resolutions;
  const maxNumImages = (schema && !schema.error ? schema.maxNumImages : null) ?? model?.maxNumImages ?? 4;
  const extraParams = settings.extraParams ?? {};

  // These three effects all guard against the SAME bug: settings.* are
  // single shared fields in the composer store, not per-model. Switching
  // models used to leave a value picked on the *previous* model sitting in
  // the store, and every one of these fields was only ever seeded when
  // empty — never re-validated against the *new* model's actual option
  // set — so a stale value would silently ride along into the next
  // request. Two real reports made this concrete: switching onto Seedream
  // v4 Edit (resolution enum "1K"/"2K"/"4K") with a lowercase "1k" left
  // over from a model like gpt-image-2 got rejected outright by muapi
  // ("Input should be '1K', '2K' or '4K'"), and switching onto Seedream 5.0
  // Lite Edit (whose real field is "quality": "basic"/"high") showed that
  // same stale "1k" in the dropdown even though it was never one of that
  // model's own options. Re-validating on every model/schema change fixes
  // both the payload and the displayed value for every affected field, not
  // just resolution.
  useEffect(() => {
    if (!resolutionOptions || resolutionOptions.length === 0) return;
    if (settings.resolution && resolutionOptions.includes(settings.resolution)) return;
    const def = schema?.defaultResolution ?? resolutionOptions[0];
    if (def) updateSettings({ resolution: def });
  }, [resolutionOptions, schema?.defaultResolution, settings.resolution, updateSettings]);

  useEffect(() => {
    if (!aspectRatios || aspectRatios.length === 0) return;
    if (settings.aspectRatio && aspectRatios.includes(settings.aspectRatio)) return;
    if (defaultAspectRatio) updateSettings({ aspectRatio: defaultAspectRatio });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspectRatios?.join(","), defaultAspectRatio, settings.aspectRatio, updateSettings]);

  // Same stale-value guard for duration now that its option list is
  // schema-driven too (e.g. 20s picked on Sora 2, then switching to a
  // 5/10-only model).
  useEffect(() => {
    if (!durationOptions || durationOptions.length === 0) return;
    if (settings.duration != null && durationOptions.includes(settings.duration)) return;
    const def =
      (schemaOk ? schema.defaultDuration : null) ?? model?.defaultDuration ?? durationOptions[0];
    if (def != null) updateSettings({ duration: def });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationOptions?.join(","), settings.duration, updateSettings]);

  useEffect(() => {
    if (settings.numImages > maxNumImages) updateSettings({ numImages: maxNumImages });
  }, [maxNumImages, settings.numImages, updateSettings]);

  // Prune extraParams whenever the schema changes: drop keys the current
  // model's live schema doesn't expose (or whose enum no longer contains
  // the stored value) so a toggle flipped on Seedance can't ride into a
  // Kling submit. Same single-shared-store reasoning as the effects above.
  useEffect(() => {
    if (!schemaOk) return;
    const current = settings.extraParams;
    if (!current || Object.keys(current).length === 0) return;
    const next: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(current)) {
      if (schema.extraBooleans.some((d) => d.field === key) && typeof value === "boolean") next[key] = value;
      else if (schema.extraEnums.some((d) => d.field === key && d.values.includes(String(value)))) next[key] = value;
      else if (schema.extraNumbers.some((d) => d.field === key) && typeof value === "number") next[key] = value;
    }
    if (Object.keys(next).length !== Object.keys(current).length) {
      updateSettings({ extraParams: next });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaOk, schema?.extraBooleans, schema?.extraEnums, schema?.extraNumbers, settings.extraParams, updateSettings]);

  function setExtra(field: string, value: string | number | boolean) {
    updateSettings({ extraParams: { ...(settings.extraParams ?? {}), [field]: value } });
  }

  if (!model) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {aspectRatios && aspectRatios.length > 0 && (
        <Dropdown
          icon={<Proportions className="h-3 w-3 text-muted shrink-0" />}
          value={
            settings.aspectRatio && aspectRatios.includes(settings.aspectRatio)
              ? settings.aspectRatio
              : defaultAspectRatio ?? aspectRatios[0]
          }
          options={aspectRatios.map((ar) => ({
            value: ar,
            label: RATIO_NAMES[ar] ? `${ar} — ${RATIO_NAMES[ar]}` : ar,
            icon: <AspectRatioIcon ratio={ar} />,
          }))}
          onChange={(v) => updateSettings({ aspectRatio: v })}
          panelTitle="Aspect ratio"
          direction={direction}
        />
      )}

      {durationSlider ? (
        <div className="control-pill">
          <input
            type="range"
            min={durationSlider.min}
            max={durationSlider.max}
            step={durationSlider.step}
            value={currentDuration}
            onChange={(e) => updateSettings({ duration: Number(e.target.value) })}
            className="w-20  slider-thin"
          />
          <span className="tabular-nums w-9 text-right">{currentDuration}s</span>
        </div>
      ) : (
        durationOptions &&
        durationOptions.length > 0 && (
          <Dropdown
            value={String(currentDuration)}
            options={durationOptions.map((d) => ({ value: String(d), label: `${d}s` }))}
            onChange={(v) => updateSettings({ duration: Number(v) })}
            panelTitle="Duration"
            direction={direction}
          />
        )
      )}

      {resolutionOptions && resolutionOptions.length > 0 && (
        <Dropdown
          value={
            settings.resolution && resolutionOptions.includes(settings.resolution)
              ? settings.resolution
              : schema?.defaultResolution ?? resolutionOptions[0]
          }
          options={resolutionOptions.map((r) => ({ value: r, label: r }))}
          onChange={(v) => updateSettings({ resolution: v })}
          panelTitle="Select quality"
          direction={direction}
        />
      )}

      {/* Fall back to the static registry flag both while the schema is
          still loading (schema === null) AND if the live fetch outright
          failed (schema.error set) — trusting an errored probe's "no field
          found" over our own registry was hiding the batch-size control for
          models that do support it whenever muapi's schema endpoint had a
          transient hiccup. Only a *successful* probe that genuinely found no
          matching field should hide the control. */}
      {(schema && !schema.error ? schema.numImagesField : model.supportsNumImages) && (
        <Stepper
          value={settings.numImages}
          min={1}
          max={maxNumImages}
          onChange={(v) => updateSettings({ numImages: v })}
        />
      )}

      {schema?.audioField && (
        <div className="control-pill">
          <Volume2 className="h-3 w-3 text-muted shrink-0" />
          <span>Audio</span>
          <Toggle
            checked={settings.generateAudio ?? schema.defaultAudio ?? true}
            onChange={(v) => updateSettings({ generateAudio: v })}
          />
        </div>
      )}

      {/* Suno/MMAudio (t2a) — genre/mood tag string, shown only when the
          live schema actually exposed a matching field (see
          STYLE_CANDIDATES in the schema route). A plain inline text input
          rather than a Dropdown since this is free text, not an enum. */}
      {schema?.styleField && (
        <div className="control-pill">
          <Tag className="h-3 w-3 text-muted shrink-0" />
          <input
            type="text"
            value={settings.musicStyle ?? ""}
            onChange={(e) => updateSettings({ musicStyle: e.target.value })}
            placeholder="Style e.g. lo-fi, cinematic"
            className="w-36 bg-transparent text-xs outline-none placeholder:text-muted"
          />
        </div>
      )}

      {/* Suno's "skip vocals, music only" toggle. */}
      {schema?.instrumentalField && (
        <div className="control-pill">
          <MicOff className="h-3 w-3 text-muted shrink-0" />
          <span>Instrumental</span>
          <Toggle
            checked={settings.instrumental ?? false}
            onChange={(v) => updateSettings({ instrumental: v })}
          />
        </div>
      )}

      {/* GPT Image 2's native `background: "transparent"` param (see
          buildPayload in generate.ts) — real alpha-channel PNG, not a
          prompt-engineered checkerboard. Surfaced generically here so any
          studio using a gpt-image model gets it, not just Typography Generator,
          which had this same toggle hardcoded locally before it moved here. */}
      {model.id.startsWith("gpt-image") && (
        <div className="control-pill">
          <Sparkles className="h-3 w-3 text-muted shrink-0" />
          <span>Transparent</span>
          <Toggle
            checked={settings.transparentBackground ?? false}
            onChange={(v) => updateSettings({ transparentBackground: v })}
          />
        </div>
      )}

      {/* ── Generic live-schema extras (see src/lib/extra-params.ts) ──────
          Driven entirely by the whitelisted subset of the model's live
          schema — no per-model wiring. This is how e.g. Seedance 2.5's
          high-bitrate toggle, gpt-image-2's quality picker, Midjourney's
          stylize/chaos/weird sliders, and nano-banana-effects' preset
          dropdown all surface. Shared with the store-free composers (Edit
          Video / Motion Control / Tripo 3D) via ExtraParamControls. */}
      <ExtraParamControls
        schema={schema}
        values={extraParams}
        onChange={setExtra}
        negativePrompt={settings.negativePrompt}
        onNegativePromptChange={(v) => updateSettings({ negativePrompt: v })}
        seed={settings.seed}
        onSeedChange={(v) => updateSettings({ seed: v })}
        direction={direction}
      />
    </div>
  );
}
