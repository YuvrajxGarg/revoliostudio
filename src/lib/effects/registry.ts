import type { EffectCategory, EffectDefinition } from "./types";
import { EFFECT_CATEGORY_LABELS } from "./types";
import { thresholdEffect } from "./algorithms/threshold";
import { edgeDetectionEffect } from "./algorithms/edgeDetection";
import { pixelateEffect } from "./algorithms/pixelate";
import { halftoneEffect } from "./algorithms/halftone";
import { ditherEffect } from "./algorithms/dither";
import { duotoneEffect } from "./algorithms/duotone";
import { asciiEffect } from "./algorithms/ascii";
import { glitchEffect } from "./algorithms/glitch";

export { EFFECT_CATEGORY_LABELS };

/** Declaration order is display order within "All" and within each category
 * tab — a curated v1 set of 8 real effects, not the full 56 of the
 * inspiration product (see the Effects Studio plan for what's deliberately
 * cut and why). Adding another effect is just: write an algorithms/*.ts file
 * exporting an EffectDefinition, then list it here. */
export const EFFECTS: EffectDefinition[] = [
  thresholdEffect,
  edgeDetectionEffect,
  pixelateEffect,
  halftoneEffect,
  ditherEffect,
  duotoneEffect,
  asciiEffect,
  glitchEffect,
];

export const EFFECT_CATEGORIES: EffectCategory[] = ["edges", "pixel", "halftone", "color", "type", "glitch"];

export function getEffect(id: string): EffectDefinition | undefined {
  return EFFECTS.find((e) => e.id === id);
}
