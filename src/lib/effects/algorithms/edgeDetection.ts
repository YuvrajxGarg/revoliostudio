import type { EffectDefinition, EffectParamValues } from "../types";
import { hexToRgb, luminance } from "../colorUtils";

const SOBEL_X = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
const SOBEL_Y = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

function apply(imageData: ImageData, params: EffectParamValues): ImageData {
  const { width, height, data: src } = imageData;
  const intensity = Number(params.intensity) / 100;
  const sensitivity = Number(params.sensitivity);
  const line = hexToRgb(String(params.lineColor));
  const bg = hexToRgb(String(params.backgroundColor));

  // Grayscale pass first — Sobel operates on a single luminance channel.
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < src.length; i += 4, p++) {
    gray[p] = luminance(src[i], src[i + 1], src[i + 2]);
  }

  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let gx = 0;
      let gy = 0;
      for (let ky = -1; ky <= 1; ky++) {
        const sy = Math.min(height - 1, Math.max(0, y + ky));
        for (let kx = -1; kx <= 1; kx++) {
          const sx = Math.min(width - 1, Math.max(0, x + kx));
          const v = gray[sy * width + sx];
          const k = (ky + 1) * 3 + (kx + 1);
          gx += v * SOBEL_X[k];
          gy += v * SOBEL_Y[k];
        }
      }
      const magnitude = Math.sqrt(gx * gx + gy * gy) * intensity;
      const isEdge = magnitude > sensitivity;
      const o = (y * width + x) * 4;
      const r = isEdge ? line.r : bg.r;
      const g = isEdge ? line.g : bg.g;
      const b = isEdge ? line.b : bg.b;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = 255;
    }
  }
  return new ImageData(out, width, height);
}

export const edgeDetectionEffect: EffectDefinition = {
  id: "edge-detection",
  name: "Edge Detection",
  category: "edges",
  description: "Traces outlines with a Sobel operator — every sharp brightness change becomes a line.",
  params: [
    { type: "slider", id: "sensitivity", label: "Sensitivity", min: 10, max: 500, default: 120 },
    { type: "slider", id: "intensity", label: "Intensity", min: 10, max: 300, default: 100, format: (v) => `${v}%` },
    { type: "color", id: "lineColor", label: "Line color", default: "#ffffff" },
    { type: "color", id: "backgroundColor", label: "Background", default: "#000000" },
  ],
  apply,
};
