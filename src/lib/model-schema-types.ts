/** One live-schema "extra" parameter surfaced generically in SettingsBar — see src/lib/extra-params.ts for the whitelist and the end-to-end flow. */
export interface ExtraBooleanParam {
  field: string;
  label: string;
  default: boolean;
}
export interface ExtraEnumParam {
  field: string;
  label: string;
  values: string[];
  default: string;
}
export interface ExtraNumberParam {
  field: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface ModelSchemaInfo {
  resolutions: string[] | null;
  defaultResolution: string | null;
  /** Real muapi field name the resolution/quality enum was found under (e.g. "resolution", "quality", "output_resolution") — providers don't standardize this, so the submit-time payload builder needs to know the real key rather than always sending "resolution". */
  resolutionField: string | null;
  duration: { min: number; max: number; step: number; default: number } | null;
  /** Real muapi field name for "how many outputs" on this model, if any (e.g. "num_images", "n", "batch_size"). null means the live schema has no such field, so the numImages control should be hidden. */
  numImagesField: string | null;
  maxNumImages: number | null;
  /** Real muapi field name for the audio on/off toggle on this model, if any (e.g. "generate_audio"). */
  audioField: string | null;
  defaultAudio: boolean | null;
  /** Real max reference-image count from the live `images_list` schema field, if this model has one. Overrides the static registry's maxReferences once loaded, since the static number can drift or be wrong. */
  maxReferenceImages: number | null;
  // ── Audio (t2a models — Suno / MMAudio) ────────────────────────────────
  /** Real muapi field name for a genre/style/mood tag string, if any (e.g. "style", "tags", "genre"). */
  styleField: string | null;
  /** Real muapi field name for custom lyrics text, if any (e.g. "lyrics", "custom_lyrics"). */
  lyricsField: string | null;
  /** Real muapi field name for the "skip vocals" toggle, if any (e.g. "instrumental", "make_instrumental"). */
  instrumentalField: string | null;
  /**
   * Real muapi field name for an *optional secondary video reference* on an
   * otherwise image-based model (e.g. an i2v/omni-reference model whose
   * schema also exposes a "video_url"/"reference_video_url"-style field for
   * a character-replace-style workflow: one image reference + one motion
   * video). Distinct from the dedicated v2v/motion/enhance composers, which
   * already have their own primary video input and never surface this.
   * `null` = this model's live schema has no such field, so no video-upload
   * slot should be shown alongside its image reference tray.
   */
  videoReferenceField: string | null;
  // ── Live-schema ground truth for controls the registry used to hardcode ──
  /**
   * Aspect-ratio enum straight from the live schema. A 2026-08 audit found
   * 72 models where the registry's static list is narrower than what the
   * API accepts, and 33 "ghost" models where the registry renders an AR
   * dropdown the schema doesn't even have — so when the live schema loads,
   * it wins over the registry both ways. `null` + no error = the schema has
   * no aspect_ratio field (hide the control), unless `sizeFromAspectRatio`.
   */
  aspectRatios: string[] | null;
  defaultAspectRatio: string | null;
  /**
   * True for models (flux-dev, hidream, hunyuan-image, z-image-turbo, …)
   * whose schema sizes output via `width`/`height` ints instead of an
   * aspect_ratio enum. The UI shows a synthetic ratio list and generate.ts
   * converts the chosen ratio to width/height within the schema's bounds —
   * previously these models' AR dropdown (when present) was a no-op.
   */
  sizeFromAspectRatio: boolean;
  /** Discrete duration enum from the live schema (e.g. Sora 2's 4/8/12/16/20s) — preferred over the registry's static list. Distinct from `duration`, the min/max slider shape. */
  durationOptions: number[] | null;
  defaultDuration: number | null;
  /** True when the live schema has a `duration` field in ANY shape (slider, enum, or plain int). When the schema loaded fine and this is false, the duration control is hidden and generate.ts omits the field. */
  hasDurationField: boolean;
  /** True when the live schema has an `aspect_ratio` field (regardless of enum shape). */
  hasAspectRatioField: boolean;
  // ── Generic whitelisted extras (see src/lib/extra-params.ts) ─────────────
  /** Live schema has a `seed` field — surfaces the optional Seed input. */
  seedField: boolean;
  /** Real field name for a negative prompt (`negative_prompt`/`negative_tags`), if any. */
  negativePromptField: string | null;
  extraBooleans: ExtraBooleanParam[];
  extraEnums: ExtraEnumParam[];
  extraNumbers: ExtraNumberParam[];
  error?: string;
}
