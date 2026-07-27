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
  error?: string;
}
