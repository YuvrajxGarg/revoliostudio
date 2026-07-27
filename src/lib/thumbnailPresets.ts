/**
 * Fixed, curated option sets for the Thumbnail Generator's structured
 * wizard (Reference -> Casting -> Scene -> Render). These are deliberately
 * NOT dynamically invented per reference — a fixed, reliable category set
 * (with an always-available "Other" custom field per category) gives a
 * consistent, predictable prompt structure every time, while reference
 * analysis (see src/app/api/thumbnail/analyze/route.ts) still adapts the
 * *content* of each category and pre-fills sensible defaults.
 */

export type EmotionPresetId =
  | "shock_gasp"
  | "hype_excitement"
  | "fear_panic"
  | "confusion"
  | "determination"
  | "smug_confident"
  | "charismatic_calm"
  | "disgust_cringe"
  | "awe_amazement"
  | "rage_intensity"
  | "laughing"
  | "other";

export const EMOTION_PRESETS: { id: EmotionPresetId; label: string }[] = [
  { id: "shock_gasp", label: "Shock / Gasp" },
  { id: "hype_excitement", label: "Hype / Excitement" },
  { id: "fear_panic", label: "Fear / Panic" },
  { id: "confusion", label: "Confusion" },
  { id: "determination", label: "Determination" },
  { id: "smug_confident", label: "Smug / Confident" },
  { id: "charismatic_calm", label: "Charismatic / Calm" },
  { id: "disgust_cringe", label: "Disgust / Cringe" },
  { id: "awe_amazement", label: "Awe / Amazement" },
  { id: "rage_intensity", label: "Rage / Intensity" },
  { id: "laughing", label: "Laughing" },
  { id: "other", label: "Other" },
];

/** Descriptive expression text dropped into each character's IDENTITY LOCK
 * block in the assembled prompt (see src/lib/thumbnailPrompt.ts). */
export const EMOTION_DESCRIPTIONS: Record<Exclude<EmotionPresetId, "other">, string> = {
  shock_gasp: "mouth open in a stunned gasp, eyebrows shot up, eyes wide with shock",
  hype_excitement: "a huge ecstatic grin, eyes blazing with excitement, whole face lit up with unstoppable hype energy",
  fear_panic: "eyes wide with genuine terror, mouth tense, a frightened expression",
  confusion: "one eyebrow raised, a puzzled squint, head tilted slightly",
  determination: "jaw locked, eyes narrowed with fierce, unwavering focus",
  smug_confident: "a knowing smirk, one eyebrow slightly raised, relaxed confidence",
  charismatic_calm:
    "a calm, magnetic gaze straight into the lens, relaxed brows, the faintest composed half-smile — effortless charisma, confident but never aggressive",
  disgust_cringe: "face recoiling in a disgusted grimace, nose wrinkled, upper lip curled",
  awe_amazement: "jaw dropped, eyes wide with genuine amazement and wonder",
  rage_intensity: "a screaming, furious expression, veins visible, intensity boiling over",
  laughing: "head thrown back, mouth open mid-laugh, eyes crinkled with joy",
};

export type SceneCategoryId = "subjectActionPose" | "keyElements" | "location" | "composition" | "backgroundTreatment";

export interface SceneCategoryDef {
  id: SceneCategoryId;
  label: string;
  required: boolean;
  presets: string[];
}

export const SCENE_CATEGORIES: SceneCategoryDef[] = [
  {
    id: "subjectActionPose",
    label: "Subject action and pose",
    required: true,
    presets: ["Selfie mid-action", "Pointing at the reveal", "Close-up reaction", "Running / escape"],
  },
  {
    id: "keyElements",
    label: "Key elements",
    required: false,
    presets: ["Money rain", "Fire vs Ice", "Half 3D-clay render", "Arrows + highlight"],
  },
  {
    id: "location",
    label: "Location",
    required: true,
    presets: ["Rooftop daylight", "Neon night city", "Luxury mansion", "Desert wasteland"],
  },
  {
    id: "composition",
    label: "Composition",
    required: false,
    presets: ["Subject right third", "Centered power pose", "Dutch-angle chaos", "Big foreground object"],
  },
  {
    id: "backgroundTreatment",
    label: "Background treatment",
    required: false,
    presets: ["Dissolving 3D grid", "Explosive light rays", "Blurred chaos", "Clean studio gradient"],
  },
];

export interface RimLightColorDef {
  id: string;
  label: string;
  swatch: string;
  /** Phrase dropped into the LIGHTING sentence of the assembled prompt. */
  promptPhrase: string;
}

export const RIM_LIGHT_COLORS: RimLightColorDef[] = [
  { id: "classic_white", label: "Classic White", swatch: "#f2f0e8", promptPhrase: "classic warm white" },
  { id: "ice_blue", label: "Ice Blue", swatch: "#8ec9ff", promptPhrase: "icy blue" },
  { id: "neon_magenta", label: "Neon Magenta", swatch: "#ff36d6", promptPhrase: "neon magenta" },
  { id: "toxic_lime", label: "Toxic Lime", swatch: "#c8ff3d", promptPhrase: "toxic lime green" },
  { id: "amber_gold", label: "Amber Gold", swatch: "#ffb238", promptPhrase: "warm amber gold" },
  { id: "pure_white", label: "Pure White", swatch: "#ffffff", promptPhrase: "pure clean white" },
];

export const DEFAULT_RIM_LIGHT_COLOR_ID = "classic_white";

export interface AspectRatioDef {
  id: string;
  label: string;
  note?: string;
}

// Kept to exactly what every image model family in thumbnailModels.ts
// actually supports (verified against each model's aspectRatios list in
// src/lib/models.ts) — no point offering a ratio the submit call would reject.
export const THUMBNAIL_ASPECT_RATIOS: AspectRatioDef[] = [
  { id: "16:9", label: "16:9", note: "YouTube video" },
  { id: "4:3", label: "4:3" },
  { id: "9:16", label: "9:16", note: "Shorts" },
  { id: "1:1", label: "1:1" },
];

export const DEFAULT_ASPECT_RATIO = "16:9";

/** Inner "safe" crop that every face/key focal point should survive being
 * cropped down to (e.g. a wide thumbnail later reused for a taller format).
 * Only meaningful for wider-than-tall ratios — a ratio that's already
 * portrait-ish has little to protect against. */
export const SAFE_ZONE_BY_ASPECT: Record<string, string | null> = {
  "16:9": "3:4",
  "4:3": "3:4",
  "9:16": null,
  "1:1": null,
};

export const MAX_CHARACTERS = 3;
