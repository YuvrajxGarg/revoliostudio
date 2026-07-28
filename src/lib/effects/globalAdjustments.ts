import type { EffectParam } from "./types";

/** Shared across every effect — these prepare the source frame before
 * whichever effect's `apply()` runs, same as Ladybug's own "Global
 * adjustments" panel (minus its video-only Frame Rate control and its
 * Background section, which don't have a clean client-side v1 equivalent). */
export const GLOBAL_ADJUSTMENT_PARAMS: EffectParam[] = [
  { type: "slider", id: "brightness", label: "Brightness", min: -100, max: 100, default: 0 },
  { type: "slider", id: "contrast", label: "Contrast", min: -100, max: 100, default: 0 },
  { type: "slider", id: "saturation", label: "Saturation", min: -100, max: 100, default: 0 },
];

export interface GlobalAdjustmentValues {
  brightness: number;
  contrast: number;
  saturation: number;
}

export const DEFAULT_GLOBAL_ADJUSTMENTS: GlobalAdjustmentValues = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
};

/** In-place — this always runs on a throwaway working-canvas ImageData the
 * pipeline just read out, never on data anything else still holds a
 * reference to (see BeforeAfterPreview's render loop). */
export function applyGlobalAdjustments(imageData: ImageData, values: GlobalAdjustmentValues): ImageData {
  const { brightness, contrast, saturation } = values;
  if (brightness === 0 && contrast === 0 && saturation === 0) return imageData;

  const data = imageData.data;
  // Standard contrast-factor formula (maps the -100..100 UI range to the
  // classic -255..255 "contrast correction factor" range).
  const contrastFactor = (259 * (contrast * 2.55 + 255)) / (255 * (259 - contrast * 2.55));
  const brightnessOffset = (brightness / 100) * 255;
  const saturationFactor = 1 + saturation / 100;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    if (brightness !== 0) {
      r += brightnessOffset;
      g += brightnessOffset;
      b += brightnessOffset;
    }
    if (contrast !== 0) {
      r = contrastFactor * (r - 128) + 128;
      g = contrastFactor * (g - 128) + 128;
      b = contrastFactor * (b - 128) + 128;
    }
    if (saturation !== 0) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + (r - gray) * saturationFactor;
      g = gray + (g - gray) * saturationFactor;
      b = gray + (b - gray) * saturationFactor;
    }

    data[i] = clamp255(r);
    data[i + 1] = clamp255(g);
    data[i + 2] = clamp255(b);
  }
  return imageData;
}

export function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}
