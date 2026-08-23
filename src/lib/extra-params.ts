/**
 * Whitelisted "extra" model parameters, discovered from the live muapi
 * schema instead of hardcoded per model.
 *
 * A 2026-08 audit of all 188 live muapi schemas found 81 models exposing
 * parameters the app could never send (Seedance 2.5's `high_bitrate`,
 * Seedance Pro's `camera_fixed`, gpt-image-2's `quality`, Midjourney's
 * `stylize`/`chaos`/`weird`, nano-banana-effects' `name` preset enum, …).
 * Rather than one registry flag + UI control + buildPayload branch per
 * param, anything listed here is handled generically end to end:
 *
 * - the /api/models/[id]/schema route probes the live schema and returns
 *   the matching subset (with enum values / ranges / defaults),
 * - SettingsBar renders a toggle / dropdown / slider per returned entry,
 * - the user's choices ride in `settings.extraParams` keyed by the REAL
 *   muapi field name,
 * - generate.ts re-validates each key against this whitelist AND the live
 *   schema at submit time before forwarding it.
 *
 * The whitelist (rather than blindly surfacing every unknown schema field)
 * is what keeps junk/duplicate fields out of the UI and arbitrary keys out
 * of the payload. Adding coverage for a future model = adding a line here.
 */

export interface ExtraFieldDef {
  /** Real muapi schema/payload field name. */
  field: string;
  /** Human label for the SettingsBar control. */
  label: string;
}

/** Boolean fields → rendered as a labeled Toggle pill. */
export const EXTRA_BOOLEAN_FIELDS: ExtraFieldDef[] = [
  { field: "high_bitrate", label: "High bitrate" }, // Seedance 2.5/2 VIP/2 Mini family
  { field: "camera_fixed", label: "Fixed camera" }, // Seedance Pro/Lite
  { field: "google_search", label: "Google search" }, // nano-banana-2 (+edit)
  { field: "thinking_mode", label: "Thinking mode" }, // wan2.7-image (+pro)
  { field: "prompt_extend", label: "Expand prompt" }, // qwen3-image
  { field: "preserve_audio", label: "Keep audio" }, // video-background-remover
];

/**
 * Enum (string) fields → rendered as a Dropdown with the schema's own enum
 * values. Only surfaced when the live schema actually has a non-empty enum
 * for the field, and never for whichever field the resolution picker
 * already claimed (gpt-image-2 has BOTH `resolution` and `quality`; the
 * resolution picker takes `resolution`, this list surfaces `quality`).
 */
export const EXTRA_ENUM_FIELDS: ExtraFieldDef[] = [
  { field: "quality", label: "Quality" }, // gpt-image-2 (+edit) low/medium/high
  { field: "output_format", label: "File format" }, // nano-banana-2, qwen3-image
  { field: "style", label: "Style" }, // ideogram-v3, pixverse-v6-transition
  { field: "render_speed", label: "Render speed" }, // ideogram-v3 / reframe
  { field: "thinking_type", label: "Thinking" }, // pixverse-v6
  { field: "omni_reference_task_type", label: "Task type" }, // Seedance 2.5 Omni
  { field: "character_orientation", label: "Character from" }, // Kling motion control
  { field: "target_gender", label: "Target face" }, // ai-video-face-swap
  { field: "audio_setting", label: "Audio source" }, // wan2.7-video-edit
  { field: "background_color", label: "Background" }, // video-background-remover
  { field: "output_container_and_codec", label: "Output codec" }, // video-background-remover
  { field: "vocal_gender", label: "Vocals" }, // Suno
  { field: "model", label: "Model version" }, // Suno V3_5…V5_5
  { field: "name", label: "Effect" }, // nano-banana-effects preset — the model's whole point
];

/**
 * Numeric fields with a schema min/max → rendered as a labeled slider.
 * (Seed is deliberately NOT here — it gets a dedicated free-form input.)
 */
export const EXTRA_NUMBER_FIELDS: ExtraFieldDef[] = [
  { field: "stylize", label: "Stylize" }, // Midjourney 0..1000
  { field: "chaos", label: "Chaos" }, // Midjourney 0..100
  { field: "weird", label: "Weird" }, // Midjourney 0..3000
  { field: "strength", label: "Strength" }, // z-image img2img 0..1
];

/** Candidate field names for a negative prompt, in priority order. */
export const NEGATIVE_PROMPT_CANDIDATES = ["negative_prompt", "negative_tags"];
