import type { EffectDefinition, EffectParamValues } from "./types";
import { applyGlobalAdjustments, type GlobalAdjustmentValues } from "./globalAdjustments";

export type MediaSource = HTMLImageElement | HTMLVideoElement;

/** Long-side cap in px for the working/output canvas — kept well below the
 * source's natural resolution so per-pixel JS effects stay responsive.
 * Video gets a lower cap than stills since it has to re-run every frame in
 * real time, not just once per param change. */
export const PREVIEW_CAPS = {
  image: { idle: 1400, interacting: 800 },
  video: { idle: 480, interacting: 320 },
};

export function computeWorkingSize(naturalWidth: number, naturalHeight: number, cap: number) {
  const longSide = Math.max(naturalWidth, naturalHeight) || 1;
  const scale = Math.min(1, cap / longSide);
  return {
    width: Math.max(1, Math.round(naturalWidth * scale)),
    height: Math.max(1, Math.round(naturalHeight * scale)),
  };
}

/**
 * One full pass: draw the current media frame into the (offscreen) working
 * canvas at (width, height), run Global Adjustments then the selected
 * effect, and paint the result into outputCanvas. Used identically by the
 * still-image recompute effect, the live video frame loop, and the export
 * pass (just called at a different resolution/cadence each time).
 */
export function renderEffect(
  media: MediaSource,
  workingCanvas: HTMLCanvasElement,
  outputCanvas: HTMLCanvasElement,
  width: number,
  height: number,
  effect: EffectDefinition | null,
  paramValues: EffectParamValues,
  globalAdjustments: GlobalAdjustmentValues
) {
  if (width <= 0 || height <= 0) return;
  if (workingCanvas.width !== width || workingCanvas.height !== height) {
    workingCanvas.width = width;
    workingCanvas.height = height;
  }
  if (outputCanvas.width !== width || outputCanvas.height !== height) {
    outputCanvas.width = width;
    outputCanvas.height = height;
  }
  const wctx = workingCanvas.getContext("2d", { willReadFrequently: true });
  const octx = outputCanvas.getContext("2d");
  if (!wctx || !octx) return;

  wctx.drawImage(media, 0, 0, width, height);
  let imageData = wctx.getImageData(0, 0, width, height);
  imageData = applyGlobalAdjustments(imageData, globalAdjustments);
  if (effect) imageData = effect.apply(imageData, paramValues);
  octx.putImageData(imageData, 0, 0);
}
