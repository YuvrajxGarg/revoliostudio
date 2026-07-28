/**
 * The effect engine's shared vocabulary. Every effect is a pure function of
 * (ImageData, params) -> ImageData — no DOM, no canvas, no React — so the
 * exact same code path renders a still preview frame, a live video frame,
 * and the final export pass.
 */

export type EffectCategory =
  | "edges"
  | "pixel"
  | "halftone"
  | "color"
  | "type"
  | "glitch";

export const EFFECT_CATEGORY_LABELS: Record<EffectCategory, string> = {
  edges: "Edges & Outlines",
  pixel: "Pixel & Mosaic",
  halftone: "Halftone & Dither",
  color: "Color",
  type: "Type & Code",
  glitch: "Analog & Glitch",
};

/** A single tunable on an effect — rendered by EffectControls into the matching input. */
export type EffectParam =
  | {
      type: "slider";
      id: string;
      label: string;
      min: number;
      max: number;
      step?: number;
      default: number;
      /** Formats the current value for display, e.g. `(v) => \`${v}px\`` — defaults to the raw number. */
      format?: (v: number) => string;
    }
  | {
      type: "select";
      id: string;
      label: string;
      options: { value: string; label: string }[];
      default: string;
    }
  | {
      type: "color";
      id: string;
      label: string;
      default: string; // "#rrggbb"
    }
  | {
      type: "toggle";
      id: string;
      label: string;
      default: boolean;
    };

/** Resolved param values keyed by EffectParam.id — a slider's value is a
 * number, a select/color's is a string, a toggle's is a boolean. */
export type EffectParamValues = Record<string, number | string | boolean>;

export interface EffectDefinition {
  id: string;
  name: string;
  category: EffectCategory;
  description: string;
  params: EffectParam[];
  /** Runs entirely on a copy of the input — never mutates its argument, since
   * the same ImageData may be reused as the "original" side of the
   * before/after compare. */
  apply(imageData: ImageData, params: EffectParamValues): ImageData;
}

/** Every effect's default param values, keyed by param id — the state an
 * EffectsStudioView resets to when the effect is first selected or reset. */
export function defaultParamValues(effect: EffectDefinition): EffectParamValues {
  const values: EffectParamValues = {};
  for (const p of effect.params) values[p.id] = p.default;
  return values;
}
