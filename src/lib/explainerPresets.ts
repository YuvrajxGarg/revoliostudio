/**
 * Fixed option catalogs for the Explainer Storyboard Generator — mirrors the
 * pattern in thumbnailPresets.ts (small, curated, editable-via-preset-button
 * catalogs rather than a freeform-only field), tuned for motion-graphics
 * explainer content instead of YouTube thumbnails.
 */

export type ExplainerStyleId =
  | "flat_vector"
  | "isometric_3d"
  | "whiteboard_doodle"
  | "kinetic_typography"
  | "corporate_clean"
  | "glass_ui"
  | "retro_halftone"
  | "clay_3d";

export interface ExplainerStyleDef {
  id: ExplainerStyleId;
  label: string;
  tagline: string;
  /** Dropped straight into the per-shot prompt template — see explainerPrompt.ts. */
  promptPhrase: string;
}

export const EXPLAINER_STYLES: ExplainerStyleDef[] = [
  {
    id: "flat_vector",
    label: "Flat vector",
    tagline: "Clean, bold, brand-friendly",
    promptPhrase:
      "clean flat vector illustration — bold flat shapes, minimal shading, confident saturated colors, crisp geometric edges",
  },
  {
    id: "isometric_3d",
    label: "Isometric 3D",
    tagline: "Techy, structured, dimensional",
    promptPhrase:
      "isometric 3D illustration — clean geometric isometric perspective, soft ambient occlusion, gentle pastel-to-saturated palette",
  },
  {
    id: "whiteboard_doodle",
    label: "Whiteboard doodle",
    tagline: "Hand-drawn, informal, friendly",
    promptPhrase:
      "hand-drawn whiteboard doodle style — loose black marker linework on a plain white background, simple sketchy energy, occasional single accent color",
  },
  {
    id: "kinetic_typography",
    label: "Kinetic typography",
    tagline: "Bold type-led frames",
    promptPhrase:
      "bold kinetic-typography-led frame — oversized clean sans-serif type as the hero element, a single simple supporting icon or shape, high contrast",
  },
  {
    id: "corporate_clean",
    label: "Corporate clean",
    tagline: "SaaS / product explainer",
    promptPhrase:
      "minimal corporate SaaS-explainer style — soft gradients, rounded geometric icons, generous negative space, restrained brand-safe palette",
  },
  {
    id: "glass_ui",
    label: "Glass / UI mockup",
    tagline: "App & interface heavy",
    promptPhrase:
      "glassmorphic UI-panel style — frosted glass cards, soft neumorphic shadows, clean app-mockup framing, subtle depth",
  },
  {
    id: "retro_halftone",
    label: "Retro halftone",
    tagline: "Poster-print energy",
    promptPhrase:
      "retro halftone-print poster style — bold outlines, limited punchy color palette, visible halftone dot/screenprint texture",
  },
  {
    id: "clay_3d",
    label: "3D clay",
    tagline: "Soft, toy-like, warm",
    promptPhrase:
      "soft 3D clay-render style — rounded matte shapes, toy-like proportions, warm friendly studio lighting, subtle plastic sheen",
  },
];

export const DEFAULT_EXPLAINER_STYLE: ExplainerStyleId = "flat_vector";

export function getExplainerStyle(id: string | null | undefined): ExplainerStyleDef {
  return EXPLAINER_STYLES.find((s) => s.id === id) ?? EXPLAINER_STYLES.find((s) => s.id === DEFAULT_EXPLAINER_STYLE)!;
}

export interface ExplainerAspectRatioDef {
  id: string;
  label: string;
  note?: string;
}

export const EXPLAINER_ASPECT_RATIOS: ExplainerAspectRatioDef[] = [
  { id: "16:9", label: "16:9", note: "Explainer video" },
  { id: "9:16", label: "9:16", note: "Shorts / Reels" },
  { id: "1:1", label: "1:1", note: "Square / social" },
];

export const DEFAULT_EXPLAINER_ASPECT_RATIO = "16:9";

/** Hard ceiling on shots per storyboard — generous, but stops a runaway
 * breakdown (or a very long pasted script) from producing an unusably large
 * — and expensive to render — batch in one go. */
export const MAX_SHOTS = 20;
