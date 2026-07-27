/**
 * Static tag data for the Reference Library's Camera / Effects / Color
 * categories. Unlike Style/Character/Location/Element (real images, stored
 * in `curated_references` + `user_references` in Supabase), these three are
 * pure prompt modifiers — picking one just appends `promptModifier` text to
 * the composer's prompt, no image involved. Kept as static data (not a DB
 * table) since there's nothing to curate-with-images or save-per-user here;
 * the tag list itself is the whole feature.
 */

export interface ReferenceTag {
  /** Shown as "#label" in the picker. */
  label: string;
  /** Appended to the prompt (with a leading ", ") when picked. */
  promptModifier: string;
}

export const CAMERA_TAGS: ReferenceTag[] = [
  { label: "cinematic", promptModifier: "cinematic camera framing" },
  { label: "portrait", promptModifier: "portrait shot, subject centered" },
  { label: "close-up", promptModifier: "extreme close-up shot" },
  { label: "mid-shot", promptModifier: "medium shot, waist-up framing" },
  { label: "full-body", promptModifier: "full-body shot" },
  { label: "wide-shot", promptModifier: "wide establishing shot" },
  { label: "high-angle", promptModifier: "shot from a high camera angle looking down" },
  { label: "low-angle", promptModifier: "shot from a low camera angle looking up" },
  { label: "first-person", promptModifier: "first-person point-of-view shot" },
  { label: "aerial", promptModifier: "aerial view from directly above" },
  { label: "drone", promptModifier: "drone shot, sweeping aerial perspective" },
  { label: "panoramic", promptModifier: "wide panoramic composition" },
  { label: "360", promptModifier: "360-degree spherical panorama framing" },
  { label: "fish-eye", promptModifier: "fish-eye lens distortion" },
  { label: "tilt-shift", promptModifier: "tilt-shift lens effect, miniature-look focus falloff" },
  { label: "symmetry", promptModifier: "perfectly symmetrical composition" },
  { label: "layered", promptModifier: "layered foreground, midground and background depth" },
];

export const EFFECT_TAGS: ReferenceTag[] = [
  { label: "earthy", promptModifier: "earthy, warm natural tones" },
  { label: "softhue", promptModifier: "soft, muted color palette" },
  { label: "b&w", promptModifier: "black and white, monochrome" },
  { label: "sepia", promptModifier: "sepia tone" },
  { label: "gold-glow", promptModifier: "warm golden glow lighting" },
  { label: "muted-green", promptModifier: "muted green color grade" },
  { label: "deep-teal", promptModifier: "deep teal color grade" },
  { label: "duotone", promptModifier: "duotone color treatment" },
  { label: "vibrant", promptModifier: "vibrant, saturated colors" },
  { label: "terracotta-&-teal", promptModifier: "terracotta and teal color grade" },
  { label: "icy-blue", promptModifier: "icy blue color grade" },
  { label: "burgundy-&-blue", promptModifier: "burgundy and blue color grade" },
  { label: "high-flash", promptModifier: "harsh direct flash photography look" },
  { label: "chiaroscuro", promptModifier: "chiaroscuro lighting, strong light-dark contrast" },
  { label: "back-light", promptModifier: "backlit, rim-lit subject" },
  { label: "studio", promptModifier: "clean studio lighting" },
  { label: "iridescent", promptModifier: "iridescent, holographic sheen" },
  { label: "dramatic", promptModifier: "dramatic, moody lighting" },
  { label: "golden-hour", promptModifier: "golden hour sunlight" },
  { label: "hardlight", promptModifier: "hard directional light, crisp shadows" },
  { label: "redscale", promptModifier: "redscale film color shift" },
  { label: "long-exposure", promptModifier: "long-exposure motion blur" },
  { label: "indoor-light", promptModifier: "warm indoor ambient lighting" },
];

export interface ColorPalette {
  name: string;
  colors: string[];
}

export const COLOR_PALETTES: ColorPalette[] = [
  { name: "revolio", colors: ["#e85002", "#161616", "#f7f7f7", "#7a0e0e"] },
  { name: "blueandyellow", colors: ["#1c3f8c", "#3f77c9", "#e8c34a", "#f4e9c9"] },
  { name: "greenforest", colors: ["#1c3320", "#355c34", "#77964a", "#c8d19a"] },
  { name: "frozenmist", colors: ["#aecbe0", "#7ea3c4", "#3d5f80", "#1e3548"] },
  { name: "icydepth", colors: ["#ffffff", "#bfeaf2", "#7fd0e0", "#1f5f6d"] },
  { name: "forestmist", colors: ["#8fae8a", "#5c7d57", "#3b5638", "#233420"] },
  { name: "polarecho", colors: ["#4fa9a3", "#7fc4be", "#a9dcd7", "#e3f5f2"] },
  { name: "minty", colors: ["#bff0e0", "#dff8ef", "#f0fbf6", "#8fd6bf"] },
  { name: "blueberry", colors: ["#ffffff", "#1e4a2e", "#2b2f7a", "#8f8fe0"] },
  { name: "coldspring", colors: ["#7fd8a0", "#5cc0cf", "#3f8fb0", "#8a5cd6"] },
  { name: "celestialice", colors: ["#bff5e0", "#7fe0c0", "#4fbf9f", "#2f8f7a"] },
  { name: "nordicdusk", colors: ["#4a5fd6", "#7a6fe0", "#c76fe0", "#e05fc0"] },
  { name: "deepsea", colors: ["#1a2b4a", "#2c4a6b", "#3d6b8a", "#a8c4d6"] },
  { name: "coolbreeze", colors: ["#2438b0", "#3f5fd6", "#6f8fe8", "#bcd0f5"] },
  { name: "mistwood", colors: ["#e8e2c9", "#cdd6c0", "#8fae9a", "#3d5c4a"] },
  { name: "deepwaterlove", colors: ["#2f5c6b", "#4a7a6b", "#c76b3f", "#8a2f2f"] },
  { name: "evergreenhaze", colors: ["#6b6f4a", "#8a8a5c", "#a89f6f", "#5c4a2f"] },
  { name: "electricdreams", colors: ["#e0206f", "#c73fe0", "#7f6fe8", "#e8d63f"] },
];
