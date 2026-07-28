import type { EffectDefinition, EffectParamValues } from "../types";
import { clamp255 } from "../globalAdjustments";

// Normalized 4x4 Bayer matrix (0..1), centered around 0 below so it can be
// added directly as a threshold bias before quantizing.
const BAYER_4X4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.5);

function quantize(value: number, step: number): number {
  return clamp255(Math.round(value / step) * step);
}

function orderedDither(imageData: ImageData, levels: number): ImageData {
  const { width, height, data: src } = imageData;
  const step = 255 / (levels - 1);
  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bias = BAYER_4X4[(y % 4) * 4 + (x % 4)] * step;
      const o = (y * width + x) * 4;
      out[o] = quantize(src[o] + bias, step);
      out[o + 1] = quantize(src[o + 1] + bias, step);
      out[o + 2] = quantize(src[o + 2] + bias, step);
      out[o + 3] = src[o + 3];
    }
  }
  return new ImageData(out, width, height);
}

/** Error-diffusion dithering — needs a float working buffer per channel
 * since propagated error can transiently push a value outside 0..255. */
function floydSteinbergDither(imageData: ImageData, levels: number): ImageData {
  const { width, height, data: src } = imageData;
  const step = 255 / (levels - 1);
  const buf = new Float32Array(src.length);
  buf.set(src);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const old = buf[o + c];
        const quantized = quantize(old, step);
        const error = old - quantized;
        buf[o + c] = quantized;
        if (x + 1 < width) buf[o + 4 + c] += (error * 7) / 16;
        if (y + 1 < height) {
          if (x > 0) buf[o - 4 + width * 4 + c] += (error * 3) / 16;
          buf[o + width * 4 + c] += (error * 5) / 16;
          if (x + 1 < width) buf[o + width * 4 + 4 + c] += (error * 1) / 16;
        }
      }
    }
  }

  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    out[i] = clamp255(buf[i]);
    out[i + 1] = clamp255(buf[i + 1]);
    out[i + 2] = clamp255(buf[i + 2]);
    out[i + 3] = src[i + 3];
  }
  return new ImageData(out, width, height);
}

function apply(imageData: ImageData, params: EffectParamValues): ImageData {
  const levels = Math.max(2, Math.round(Number(params.levels)));
  return params.algorithm === "floyd-steinberg" ? floydSteinbergDither(imageData, levels) : orderedDither(imageData, levels);
}

export const ditherEffect: EffectDefinition = {
  id: "dither",
  name: "Dither",
  category: "halftone",
  description: "Quantizes color into a handful of steps, then either an ordered Bayer pattern or Floyd-Steinberg error diffusion disguises the banding.",
  params: [
    {
      type: "select",
      id: "algorithm",
      label: "Pattern",
      options: [
        { value: "ordered", label: "Ordered" },
        { value: "floyd-steinberg", label: "Floyd-Steinberg" },
      ],
      default: "ordered",
    },
    { type: "slider", id: "levels", label: "Levels", min: 2, max: 8, default: 3 },
  ],
  apply,
};
