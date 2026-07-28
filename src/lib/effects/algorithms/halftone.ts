import type { EffectDefinition, EffectParamValues } from "../types";
import { hexToRgb, luminance } from "../colorUtils";

/**
 * Classic rotated dot-screen halftone: the dot GRID is rotated by `angle`,
 * but each dot's size still samples the source image's own (unrotated)
 * luminance at that cell — so the pattern rotates while the picture it's
 * describing doesn't. Darker source pixels get bigger dots (more "ink"),
 * same convention as print halftoning.
 */
function apply(imageData: ImageData, params: EffectParamValues): ImageData {
  const { width, height, data: src } = imageData;
  const cellSize = Number(params.cellSize);
  const angleRad = (Number(params.angle) * Math.PI) / 180;
  const dotScale = Number(params.dotScale) / 100;
  const dot = hexToRgb(String(params.dotColor));
  const bg = hexToRgb(String(params.backgroundColor));
  const maxRadius = (cellSize / 2) * dotScale;

  const cx = width / 2;
  const cy = height / 2;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  const out = new Uint8ClampedArray(src.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      // Rotate into "grid space" — the space where the halftone cells are axis-aligned.
      const rx = dx * cos + dy * sin + cx;
      const ry = -dx * sin + dy * cos + cy;

      const cellX = Math.floor(rx / cellSize);
      const cellY = Math.floor(ry / cellSize);
      const cellCenterRx = (cellX + 0.5) * cellSize;
      const cellCenterRy = (cellY + 0.5) * cellSize;

      // Rotate the cell's center back into image space to sample the source luminance it represents.
      const cdx = cellCenterRx - cx;
      const cdy = cellCenterRy - cy;
      const sampleX = Math.min(width - 1, Math.max(0, Math.round(cdx * cos - cdy * sin + cx)));
      const sampleY = Math.min(height - 1, Math.max(0, Math.round(cdx * sin + cdy * cos + cy)));
      const sampleO = (sampleY * width + sampleX) * 4;
      const l = luminance(src[sampleO], src[sampleO + 1], src[sampleO + 2]);
      const radius = maxRadius * (1 - l / 255);

      const distToCenter = Math.hypot(rx - cellCenterRx, ry - cellCenterRy);
      const inDot = distToCenter <= radius;

      const o = (y * width + x) * 4;
      out[o] = inDot ? dot.r : bg.r;
      out[o + 1] = inDot ? dot.g : bg.g;
      out[o + 2] = inDot ? dot.b : bg.b;
      out[o + 3] = 255;
    }
  }
  return new ImageData(out, width, height);
}

export const halftoneEffect: EffectDefinition = {
  id: "halftone",
  name: "Halftone",
  category: "halftone",
  description: "Print-style dot screen — darker areas get bigger dots, on a rotatable grid.",
  params: [
    { type: "slider", id: "cellSize", label: "Cell size", min: 4, max: 40, default: 10, format: (v) => `${v}px` },
    { type: "slider", id: "angle", label: "Angle", min: 0, max: 90, default: 15, format: (v) => `${v}°` },
    { type: "slider", id: "dotScale", label: "Dot scale", min: 50, max: 150, default: 100, format: (v) => `${v}%` },
    { type: "color", id: "dotColor", label: "Dot color", default: "#000000" },
    { type: "color", id: "backgroundColor", label: "Background", default: "#ffffff" },
  ],
  apply,
};
